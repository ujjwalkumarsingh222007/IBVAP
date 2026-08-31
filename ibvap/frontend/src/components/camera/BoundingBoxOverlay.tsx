import React from 'react';
import { AIDetection, BoundingBoxRect } from '../../types';

interface BoundingBoxOverlayProps {
  detections: AIDetection[];
  containerWidth: number;
  containerHeight: number;
  videoNaturalWidth: number;
  videoNaturalHeight: number;
}

export const BoundingBoxOverlay: React.FC<BoundingBoxOverlayProps> = ({
  detections,
  containerWidth,
  containerHeight,
  videoNaturalWidth,
  videoNaturalHeight,
}) => {
  if (!detections || detections.length === 0 || !videoNaturalWidth || !videoNaturalHeight) {
    return null;
  }

  // Calculate actual rendered video dimensions inside container (object-contain behavior)
  const videoAspect = videoNaturalWidth / videoNaturalHeight;
  const containerAspect = containerWidth / containerHeight;

  let renderWidth = containerWidth;
  let renderHeight = containerHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (containerAspect > videoAspect) {
    // Video is limited by container height (pillarboxing)
    renderHeight = containerHeight;
    renderWidth = renderHeight * videoAspect;
    offsetX = (containerWidth - renderWidth) / 2;
  } else {
    // Video is limited by container width (letterboxing)
    renderWidth = containerWidth;
    renderHeight = renderWidth / videoAspect;
    offsetY = (containerHeight - renderHeight) / 2;
  }

  const scaleX = renderWidth / videoNaturalWidth;
  const scaleY = renderHeight / videoNaturalHeight;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {detections.map((det, index) => {
        let rawBbox: BoundingBoxRect | null = null;

        if (det.bbox) {
          if (Array.isArray(det.bbox) && det.bbox.length === 4) {
            rawBbox = {
              x1: det.bbox[0],
              y1: det.bbox[1],
              x2: det.bbox[2],
              y2: det.bbox[3],
            };
          } else if (typeof det.bbox === 'object') {
            const b = det.bbox as any;
            rawBbox = {
              x1: b.x1 ?? b.x ?? 0,
              y1: b.y1 ?? b.y ?? 0,
              x2: b.x2 ?? (b.x ?? 0) + (b.w ?? b.width ?? 0),
              y2: b.y2 ?? (b.y ?? 0) + (b.h ?? b.height ?? 0),
            };
          }
        }

        if (!rawBbox) return null;

        const left = offsetX + rawBbox.x1 * scaleX;
        const top = offsetY + rawBbox.y1 * scaleY;
        const width = (rawBbox.x2 - rawBbox.x1) * scaleX;
        const height = (rawBbox.y2 - rawBbox.y1) * scaleY;

        const isPerson = det.class_name === 'person';
        const isKnown = det.is_known || det.status === 'KNOWN';
        const isFlagged = det.is_flagged || det.status === 'FLAGGED' || det.watchlist_match;

        let borderColor = '#f59e0b'; // UNKNOWN amber
        let bgColor = 'rgba(245, 158, 11, 0.08)';
        let tagBg = 'bg-amber-500 text-slate-950 font-bold';
        let tagText = '';

        if (isPerson) {
          if (isKnown) {
            borderColor = '#10b981'; // KNOWN green
            bgColor = 'rgba(16, 185, 129, 0.08)';
            tagBg = 'bg-emerald-500 text-slate-950 font-bold';
            const name = det.person_name || 'REGISTERED';
            tagText = `✓ ${name} (KNOWN)`;
          } else if (isFlagged) {
            borderColor = '#ef4444'; // FLAGGED red
            bgColor = 'rgba(239, 68, 68, 0.15)';
            tagBg = 'bg-red-600 text-white font-bold animate-pulse';
            const name = det.person_name || 'FLAGGED';
            tagText = `🚨 ${name} (FLAGGED)`;
          } else {
            tagText = `⚠ UNKNOWN PERSON`;
          }
        } else {
          // Vehicle
          const plate = det.plate_number;
          const isAnalyzing = det.status === 'ANALYZING' || plate === 'Scanning...' || (!isKnown && !isFlagged && (!plate || plate === 'Scanning...'));

          if (isAnalyzing) {
            borderColor = '#06b6d4'; // Cyan
            bgColor = 'rgba(6, 182, 212, 0.08)';
            tagBg = 'bg-cyan-500 text-slate-950 font-bold';
            tagText = `🔍 VEHICLE | Plate: Scanning... (ANALYZING)`;
          } else if (isKnown) {
            borderColor = '#10b981'; // KNOWN green
            bgColor = 'rgba(16, 185, 129, 0.08)';
            tagBg = 'bg-emerald-500 text-slate-950 font-bold';
            tagText = plate ? `✓ VEHICLE | Plate: ${plate} (KNOWN)` : `✓ REGISTERED VEHICLE`;
          } else if (isFlagged) {
            borderColor = '#ef4444'; // FLAGGED red
            bgColor = 'rgba(239, 68, 68, 0.15)';
            tagBg = 'bg-red-600 text-white font-bold animate-pulse';
            tagText = plate ? `🚨 VEHICLE | Plate: ${plate} (FLAGGED)` : `🚨 FLAGGED VEHICLE`;
          } else {
            borderColor = '#f59e0b'; // Amber
            bgColor = 'rgba(245, 158, 11, 0.08)';
            tagBg = 'bg-amber-500 text-slate-950 font-bold';
            tagText = plate ? `⚠ VEHICLE | Plate: ${plate} (UNKNOWN)` : `⚠ VEHICLE DETECTED | Plate: NOT READABLE`;
          }
        }

        return (
          <div
            key={`bbox_${det.track_id || index}_${left.toFixed(0)}_${top.toFixed(0)}`}
            className="absolute transition-all duration-100 ease-out"
            style={{
              left: `${Math.max(0, left)}px`,
              top: `${Math.max(0, top)}px`,
              width: `${Math.max(20, width)}px`,
              height: `${Math.max(20, height)}px`,
              border: `2px solid ${borderColor}`,
              backgroundColor: bgColor,
              boxShadow: `0 0 12px ${borderColor}40`,
            }}
          >
            {/* Top Label Tag */}
            <div
              className={`absolute -top-7 left-0 px-2 py-0.5 rounded text-[11px] font-mono tracking-wide whitespace-nowrap shadow-md flex items-center gap-1.5 ${tagBg}`}
            >
              <span>{tagText}</span>
              {det.confidence ? (
                <span className="opacity-80 text-[9px] font-sans">
                  {Math.round(det.confidence * 100)}%
                </span>
              ) : null}
            </div>

            {/* Corner crosshairs for tactical surveillance look */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2" style={{ borderColor }} />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2" style={{ borderColor }} />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2" style={{ borderColor }} />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2" style={{ borderColor }} />
          </div>
        );
      })}
    </div>
  );
};
