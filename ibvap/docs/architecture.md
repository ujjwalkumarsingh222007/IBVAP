We are a 4-member team building an SIH software project called **IBVAP — Intelligent Border Video Analytics Platform**.

The goal is to convert existing IP CCTV/RTSP camera streams into an intelligent surveillance platform using AI software.

We need to build ONE integrated application, but each team member must work independently without code conflicts.

## MASTER ARCHITECTURE

Use this architecture:

IP CCTV / RTSP
↓
Video Processing / OpenCV
↓
┌───────────────────────┬───────────────────────┐
│                       │
Member 1                Member 2
Computer Vision         ANPR
YOLO                    Plate Detection
Tracking                OCR
Virtual Fence           Plate Recognition
Intrusion Detection    Watchlist
│                       │
└───────────┬───────────┘
↓
Member 3
FastAPI Backend
↓
PostgreSQL
↓
REST API
↓
Member 4
React Frontend

## TECHNOLOGY STACK

Frontend:

* React
* Vite
* JavaScript/TypeScript
* Tailwind CSS
* Recharts where useful

Backend:

* Python
* FastAPI
* Pydantic
* SQLAlchemy
* PostgreSQL

AI:

* Python
* OpenCV
* YOLO
* OCR for ANPR
* Modular AI services

Development:

* Git
* GitHub
* Separate branches for each member
* Docker only after the basic application works

## TEAM OWNERSHIP

Member 1 owns ONLY:
ai/member1_cv/

Responsibilities:

* YOLO object detection
* Person detection
* Vehicle detection
* Object tracking
* Virtual fence
* Intrusion detection
* Computer-vision event generation

Member 2 owns ONLY:
ai/member2_anpr/

Responsibilities:

* Number plate detection
* OCR
* Plate recognition
* Vehicle identification
* Watchlist matching
* ANPR event generation

Member 3 owns:
backend/

Responsibilities:

* FastAPI
* PostgreSQL
* Database models
* API routes
* Event ingestion
* Event processing
* Alerts
* Camera APIs
* Watchlist APIs

Member 4 owns:
frontend/

Responsibilities:

* React dashboard
* Live camera interface
* Alerts
* Events
* Camera management UI
* Watchlist UI
* Analytics
* API integration

## IMPORTANT ANTI-COLLISION RULE

NEVER mix the four modules.

Member 1 must NOT create React, FastAPI, PostgreSQL or ANPR code unless explicitly requested.

Member 2 must NOT create React, FastAPI or Member 1's computer vision implementation.

Member 3 must NOT rewrite AI implementations.

Member 4 must NOT implement AI or database logic.

If integration is required, use clearly defined interfaces rather than copying another member's code.

## COMMON EVENT CONTRACT

All AI modules must communicate using a common JSON event structure.

Base format:

{
"camera_id": "CAM-01",
"event_type": "OBJECT_DETECTED",
"timestamp": "2026-08-28T15:30:00",
"confidence": 0.94,
"metadata": {}
}

Examples of event_type:

* OBJECT_DETECTED
* VEHICLE_DETECTED
* PERSON_DETECTED
* ANPR_DETECTED
* INTRUSION_DETECTED
* WATCHLIST_MATCH
* SUSPICIOUS_ACTIVITY

Member-specific metadata can be placed inside "metadata".

The backend must not depend on the internal implementation of the AI modules.

## SHARED DIRECTORY

Create:

shared/
event_schema/
constants/

Only shared contracts, schemas and constants should be placed here.

Do not place member-specific implementation code in shared/.

## GIT RULES

Create these branches:

main
member1-cv
member2-anpr
member3-backend
member4-frontend

Each member primarily modifies their own directory.

Do not modify another member's module unless explicitly required for integration.

Use small commits with clear messages.

## API CONTRACT

Before generating integration code, define the API contract first.

Example:

POST /api/v1/events

GET /api/v1/events

GET /api/v1/cameras

GET /api/v1/alerts

GET /api/v1/detections

GET /api/v1/watchlist

The exact API structure can be improved if necessary, but it must remain consistent for all four members.

## PROJECT STRUCTURE

Use:

ibvap/
├── frontend/
├── backend/
├── ai/
│   ├── member1_cv/
│   └── member2_anpr/
├── shared/
│   ├── event_schema/
│   └── constants/
├── tests/
├── docs/
├── .env.example
├── .gitignore
├── README.md
└── docker-compose.yml

## IMPORTANT DEVELOPMENT RULE

Do NOT try to generate the entire project for every member.

Instead, when I tell you which member I am, generate ONLY that member's work.

For example:

If I say "I am Member 1", generate only Member 1's Computer Vision module.

If I say "I am Member 2", generate only Member 2's ANPR module.

If I say "I am Member 3", generate only the backend.

If I say "I am Member 4", generate only the frontend.

## ANTIGRAVITY PROMPT GENERATION

Your job is NOT to directly generate the entire project.

Your job is to generate a precise prompt that I can paste into Google Antigravity so that Antigravity creates the requested module.

Every Antigravity prompt must include:

1. Project context
2. Current member
3. Exact ownership
4. Files that may be created/modified
5. Files that must NOT be modified
6. Technology requirements
7. API/interface contracts
8. Input/output format
9. Error handling
10. Testing requirements
11. README/documentation requirements
12. Git safety rules
13. How the module will later integrate with the other modules

Before generating code, ask which member I am and which phase I am currently implementing if that information has not been provided.

The generated Antigravity prompt must tell Antigravity:

"Do not rewrite or restructure unrelated modules. Preserve existing code. Only create or modify files within the explicitly allowed scope."

The architecture must remain modular so that all four members can merge their work into one GitHub repository later.
