import sys
import os
import numpy as np

# Ensure backend root is in sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import SessionLocal
from app.models import Person, FaceEmbedding

def inspect_faces():
    db = SessionLocal()
    people = db.query(Person).all()
    print("\nREGISTERED PEOPLE")
    print("-----------------")
    if not people:
        print("No registered persons found in database.")
    for p in people:
        embs = db.query(FaceEmbedding).filter(FaceEmbedding.person_id == p.id).all()
        has_primary = bool(p.face_embedding and len(p.face_embedding) > 0)
        has_samples = len(embs) > 0
        
        # Check dimension and validity
        dim = 0
        is_finite = True
        is_norm = True
        sample_vec = None
        if has_samples and embs[0].embedding:
            sample_vec = np.array(embs[0].embedding, dtype=np.float32)
            dim = len(sample_vec)
        elif has_primary:
            sample_vec = np.array(p.face_embedding, dtype=np.float32)
            dim = len(sample_vec)

        if sample_vec is not None and dim > 0:
            is_finite = bool(np.all(np.isfinite(sample_vec)))
            norm_val = float(np.linalg.norm(sample_vec))
            is_norm = bool(0.90 <= norm_val <= 1.10)
            emb_status = "VALID" if is_finite and is_norm else "INVALID"
        else:
            emb_status = "MISSING"

        print(f"Person: {p.name}")
        print(f"  Person Code: {p.person_code}")
        print(f"  Status: {p.status}")
        print(f"  Embedding: {emb_status}")
        print(f"  Dimension: {dim}")
        print(f"  Norm: {'VALID' if is_norm else 'INVALID'}")
        print(f"  Sample Count: {len(embs)}")
        print()

    db.close()

if __name__ == "__main__":
    inspect_faces()
