import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from services.run_store import load_run
from services.pdf_generator import generate_pdf

logger = logging.getLogger(__name__)
router = APIRouter()


class ExportPdfRequest(BaseModel):
    run_id: str


@router.post("/export/pdf")
def export_pdf(req: ExportPdfRequest):
    result = load_run(req.run_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Run not found")

    logger.info("Generating PDF for run %s", req.run_id)
    pdf_bytes = generate_pdf(result)

    filename = f"portfolio-report-{req.run_id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
