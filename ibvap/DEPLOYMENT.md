# IBVAP — Production Deployment & Configuration Guide

This guide details environment setup, configuration parameters, and containerization/process management instructions for deploying the Integrated Border Video Analytics Platform (IBVAP).

---

## 1. Environment Configuration

Copy the sample environment file to `.env`:
```bash
cp backend/.env.example backend/.env
```

### Production Configuration Parameters

| Parameter | Default | Production Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite:///ibvap.db` | Connection URI. For PostgreSQL: `postgresql://user:pass@host:5432/ibvap` |
| `JWT_SECRET_KEY` | *(Default string)* | **REQUIRED TO CHANGE IN PRODUCTION**. Cryptographically strong secret key. |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm. |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `720` | Token validity lifetime in minutes (12 hours). |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated list of allowed frontend origins. |
| `MAX_FRAME_SIZE_BYTES` | `10485760` | Max single frame upload size (10 MB). |
| `PLATE_MODEL_PATH` | `../ai/member2_anpr/models/license_plate.pt` | Path to PyTorch YOLO license plate weights. |
| `PLATE_CONFIDENCE_THRESHOLD`| `0.25` | Minimum confidence score for plate ROI bounding box. |
| `ANPR_OCR_CONF` | `0.30` | Minimum character recognition confidence. |
| `ANPR_OCR_GPU` | `false` | Set to `true` if NVIDIA CUDA GPU is available for EasyOCR acceleration. |
| `THREAT_CORRELATION_WINDOW_SECONDS` | `10.0` | Sliding window duration for multi-event threat correlation. |
| `THREAT_SUPPRESSION_COOLDOWN_SECONDS` | `10.0` | Duplicate threat suppression cooldown. |
| `LOG_LEVEL` | `INFO` | Application log level (`DEBUG`, `INFO`, `WARNING`, `ERROR`). |

---

## 2. Backend Deployment

### Virtual Environment & Dependencies
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

### Production Execution with Gunicorn & Uvicorn Workers
```bash
# Multi-worker production deployment
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

---

## 3. Frontend Deployment

### Production Build & Assets Generation
```bash
cd frontend
npm install
npm run build
```
The optimized HTML, CSS, and JavaScript bundles are output to `frontend/dist/`.

### Serving with Nginx
Sample Nginx server configuration:
```nginx
server {
    listen 80;
    server_name surveillance.example.com;

    location / {
        root /var/www/ibvap/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
    }
}
```

---

## 4. Security & Compliance Checklist
- [x] Rotate `JWT_SECRET_KEY` in production environment.
- [x] Enforce HTTPS via reverse proxy TLS certificates (Let's Encrypt / Certbot).
- [x] Restrict `CORS_ORIGINS` to authorized frontend domain only.
- [x] Verify database backups (`backend/ibvap.db` or PostgreSQL automated snapshot).
- [x] Verify file permission boundaries for uploaded weights (`ai/member2_anpr/models/`).
