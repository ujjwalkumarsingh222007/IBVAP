"""
IBVAP - Member 2 ANPR Module - stream_processor.py

Real-time video stream processor connecting RTSPStreamReader to ANPRPipeline.
Supports frame skipping, runtime statistics tracking, and graceful stream termination.
"""

from __future__ import annotations

import logging
import time
from dataclasses import asdict, dataclass
from typing import Any, Callable, Dict, Iterator, List, Optional, Tuple

import numpy as np

from .pipeline import ANPRPipeline
from .schemas import ANPRResult, IBVAPEvent
from .stream import RTSPStreamReader, mask_rtsp_url

logger = logging.getLogger(__name__)


@dataclass
class StreamStatistics:
    """Runtime processing metrics for an active ANPR video stream."""
    camera_id: str
    source_description: str
    total_frames_read: int = 0
    frames_processed: int = 0
    frames_skipped: int = 0
    successful_reads: int = 0
    failed_reads: int = 0
    events_generated: int = 0
    reconnect_count: int = 0
    processing_fps: float = 0.0
    average_latency_ms: float = 0.0
    uptime_seconds: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert statistics to dictionary."""
        return asdict(self)

    def summary_table(self) -> str:
        """Format statistics into human-readable summary table."""
        return "\n".join([
            "=" * 60,
            f"IBVAP Real-Time Stream Processing Statistics: {self.camera_id}",
            "=" * 60,
            f"Source                 : {self.source_description}",
            f"Stream Uptime          : {self.uptime_seconds:.2f} s",
            f"Total Frames Read      : {self.total_frames_read}",
            f"Frames Processed (ANPR): {self.frames_processed}",
            f"Frames Skipped         : {self.frames_skipped}",
            f"Failed Frame Reads     : {self.failed_reads}",
            f"Reconnection Count     : {self.reconnect_count}",
            f"Events Generated       : {self.events_generated}",
            f"Processing Throughput  : {self.processing_fps:.2f} FPS",
            f"Average ANPR Latency   : {self.average_latency_ms:.2f} ms",
            "=" * 60,
        ])


class ANPRStreamProcessor:
    """
    Connects an RTSPStreamReader to an ANPRPipeline, handling frame sampling,
    error recovery, and runtime performance tracking.

    Parameters
    ----------
    stream_reader:
        Configured RTSPStreamReader instance.
    pipeline:
        Configured ANPRPipeline instance.
    frame_skip:
        Number of frames to skip between ANPR evaluations (e.g. frame_skip=4 processes 1 of 5 frames).
    camera_id:
        Optional camera ID override (defaults to stream_reader.camera_id).
    """

    def __init__(
        self,
        stream_reader: RTSPStreamReader,
        pipeline: ANPRPipeline,
        frame_skip: int = 0,
        camera_id: Optional[str] = None,
    ) -> None:
        if frame_skip < 0:
            raise ValueError("frame_skip must be non-negative")

        self.stream_reader = stream_reader
        self.pipeline = pipeline
        self.frame_skip = int(frame_skip)
        self.camera_id = camera_id or stream_reader.camera_id

        self.stats = StreamStatistics(
            camera_id=self.camera_id,
            source_description=mask_rtsp_url(self.stream_reader.source),
        )

        self._latencies_sec: List[float] = []
        self._is_running = False

        logger.info(
            "ANPRStreamProcessor initialized for '%s' (frame_skip=%d)",
            self.camera_id,
            self.frame_skip,
        )

    def process_stream(
        self,
        max_frames: Optional[int] = None,
        stop_condition: Optional[Callable[[], bool]] = None,
        vehicle_id: Optional[str] = None,
    ) -> Iterator[Tuple[int, List[ANPRResult], List[IBVAPEvent]]]:
        """
        Process the video stream frame-by-frame as an iterator.

        Parameters
        ----------
        max_frames:
            Optional maximum number of frames to read before stopping.
        stop_condition:
            Optional callback returning True when the stream loop should terminate.
        vehicle_id:
            Optional vehicle ID from external tracking.

        Yields
        ------
        Tuple[int, List[ANPRResult], List[IBVAPEvent]]
            (frame_index, list_of_anpr_results, list_of_ibvap_events)
        """
        self._is_running = True
        start_time = time.monotonic()
        frame_idx = 0

        try:
            if not self.stream_reader.is_opened():
                if not self.stream_reader.open():
                    logger.error("Failed to open stream for processing.")
                    return

            while self._is_running:
                if stop_condition is not None and stop_condition():
                    logger.info("Stop condition triggered; terminating stream loop.")
                    break

                if max_frames is not None and frame_idx >= max_frames:
                    logger.info("Reached max_frames limit (%d); stopping stream.", max_frames)
                    break

                success, frame = self.stream_reader.read()
                if not success or frame is None:
                    self.stats.failed_reads += 1
                    logger.warning("Frame read failed / EOF reached")
                    # If stream is permanently closed/EOF
                    if not self.stream_reader.is_opened():
                        logger.info("Stream closed or reached EOF.")
                        break
                    continue

                self.stats.total_frames_read += 1
                self.stats.successful_reads += 1
                frame_idx += 1

                # Frame Sampling / Skipping
                if self.frame_skip > 0 and (frame_idx - 1) % (self.frame_skip + 1) != 0:
                    self.stats.frames_skipped += 1
                    yield (frame_idx, [], [])
                    continue

                # Run ANPR Pipeline on sampled frame
                t0 = time.perf_counter()
                try:
                    results = self.pipeline.process_frame(
                        frame=frame,
                        camera_id=self.camera_id,
                        vehicle_id=vehicle_id,
                    )
                except Exception as exc:
                    logger.error("Pipeline error on frame #%d: %s", frame_idx, exc, exc_info=True)
                    results = [ANPRResult(error=f"Stream processing exception: {exc}", vehicle_id=vehicle_id)]

                t_dur = time.perf_counter() - t0
                self._latencies_sec.append(t_dur)
                self.stats.frames_processed += 1

                # Extract valid events
                events: List[IBVAPEvent] = []
                for r in results:
                    if r.success and r.event is not None and not r.duplicate_suppressed:
                        events.append(r.event)
                        self.stats.events_generated += 1

                yield (frame_idx, results, events)

        finally:
            self._is_running = False
            total_elapsed = time.monotonic() - start_time
            self.stats.uptime_seconds = round(total_elapsed, 3)
            self.stats.reconnect_count = self.stream_reader.total_reconnects

            if self.stats.frames_processed > 0:
                self.stats.processing_fps = round(self.stats.frames_processed / max(total_elapsed, 0.001), 2)
                avg_ms = (sum(self._latencies_sec) / len(self._latencies_sec)) * 1000.0
                self.stats.average_latency_ms = round(avg_ms, 2)

            self.stream_reader.release()
            logger.info("Stream processor stopped. Total frames: %d", frame_idx)

    def process_stream_events(
        self,
        max_frames: Optional[int] = None,
        stop_condition: Optional[Callable[[], bool]] = None,
        vehicle_id: Optional[str] = None,
    ) -> Iterator[IBVAPEvent]:
        """
        Simplified generator directly yielding individual IBVAPEvents for backend consumption.
        """
        for _, _, events in self.process_stream(max_frames=max_frames, stop_condition=stop_condition, vehicle_id=vehicle_id):
            for event in events:
                yield event

    def stop(self) -> None:
        """Signal the stream processor to terminate its processing loop."""
        self._is_running = False
