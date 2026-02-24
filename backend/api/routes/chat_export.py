"""
Chat 내보내기 API 라우터
직접 내보내기 및 파일 다운로드 엔드포인트
"""
import logging
from io import BytesIO
from typing import Optional
from urllib.parse import quote
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.services.chat_excel_export_service import chat_excel_export_service
from backend.services.chat_docx_export_service import chat_docx_export_service
from backend.services.chat_pdf_export_service import chat_pdf_export_service
from backend.services.chat_text_export_service import chat_text_export_service
from backend.services.tool_executor_service import file_storage
from backend.utils.error_handler import get_http_error_detail

logger = logging.getLogger("uvicorn")

router = APIRouter(prefix="/api/chat", tags=["chat-export"])


# ============================================================================
# Function Calling 파일 다운로드 엔드포인트
# ============================================================================

@router.get("/export/download/{file_id}")
async def download_exported_file(file_id: str):
    """
    Function Calling으로 생성된 파일 다운로드

    Args:
        file_id: 파일 저장소 ID

    Returns:
        StreamingResponse: 파일 다운로드 응답

    Raises:
        HTTPException: 파일을 찾을 수 없거나 만료된 경우
    """
    try:
        logger.info(f"[FILE DOWNLOAD] Requested file: {file_id}")

        # 파일 저장소에서 조회
        file_data = file_storage.get(file_id)

        if not file_data:
            logger.warning(f"[FILE DOWNLOAD] File not found or expired: {file_id}")
            raise HTTPException(
                status_code=404,
                detail="파일을 찾을 수 없거나 만료되었습니다. 다시 생성해주세요."
            )

        # 파일명 인코딩 (한글 지원)
        encoded_filename = quote(file_data.filename)

        logger.info(f"[FILE DOWNLOAD] Serving file: {file_data.filename} ({len(file_data.content)} bytes)")

        # 스트리밍 응답으로 파일 전송
        file_stream = BytesIO(file_data.content)

        return StreamingResponse(
            file_stream,
            media_type=file_data.content_type,
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
                "Content-Length": str(len(file_data.content))
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FILE DOWNLOAD] Failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=get_http_error_detail(e, "download", "파일 다운로드 실패")
        )


# ============================================================================
# 직접 내보내기 엔드포인트 (UI 메뉴용)
# ============================================================================

class DirectExportRequest(BaseModel):
    """직접 내보내기 요청"""
    content: str
    filename: Optional[str] = None
    title: Optional[str] = None


# 형식별 내보내기 설정 레지스트리
_EXPORT_FORMATS = {
    "excel": {
        "export_fn": lambda content, filename, title: chat_excel_export_service.export_to_excel(data=content, filename=filename),
        "extension": ".xlsx",
        "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "default_filename": "export",
        "default_title": None,
        "label": "엑셀 파일",
        "error_label": "엑셀 내보내기 실패",
    },
    "docx": {
        "export_fn": lambda content, filename, title: chat_docx_export_service.export_to_docx(content=content, title=title, filename=filename),
        "extension": ".docx",
        "content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "default_filename": "document",
        "default_title": "문서",
        "label": "Word 문서",
        "error_label": "Word 문서 내보내기 실패",
    },
    "pdf": {
        "export_fn": lambda content, filename, title: chat_pdf_export_service.export_to_pdf(content=content, title=title, filename=filename),
        "extension": ".pdf",
        "content_type": "application/pdf",
        "default_filename": "document",
        "default_title": "PDF 문서",
        "label": "PDF 파일",
        "error_label": "PDF 내보내기 실패",
    },
    "md": {
        "export_fn": lambda content, filename, title: chat_text_export_service.export_to_markdown(content=content, filename=filename, title=title),
        "extension": ".md",
        "content_type": "text/markdown; charset=utf-8",
        "default_filename": "export",
        "default_title": None,
        "label": "마크다운 파일",
        "error_label": "마크다운 내보내기 실패",
    },
    "txt": {
        "export_fn": lambda content, filename, title: chat_text_export_service.export_to_text(content=content, filename=filename, title=title),
        "extension": ".txt",
        "content_type": "text/plain; charset=utf-8",
        "default_filename": "export",
        "default_title": None,
        "label": "텍스트 파일",
        "error_label": "텍스트 내보내기 실패",
    },
}


async def _handle_direct_export(format_key: str, request: DirectExportRequest) -> dict:
    """
    직접 내보내기 공통 핸들러

    Args:
        format_key: 형식 키 (excel, docx, pdf, md, txt)
        request: 내보내기 요청

    Returns:
        dict: 파일 ID 및 파일명
    """
    fmt = _EXPORT_FORMATS[format_key]

    if not request.content or not request.content.strip():
        raise HTTPException(status_code=400, detail="내보낼 내용이 없습니다.")

    filename = request.filename or fmt["default_filename"]
    title = request.title or fmt["default_title"]

    try:
        file_bytes = fmt["export_fn"](request.content, filename, title)

        full_filename = f"{filename}{fmt['extension']}"
        file_id = file_storage.store(
            filename=full_filename,
            content=file_bytes,
            content_type=fmt["content_type"]
        )

        return {
            "success": True,
            "file_id": file_id,
            "filename": full_filename,
            "message": f"{fmt['label']} '{full_filename}'이(가) 생성되었습니다."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DIRECT EXPORT] {format_key} export failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=get_http_error_detail(e, "export", fmt["error_label"])
        )


@router.post("/export/excel")
async def export_to_excel_direct(request: DirectExportRequest):
    """콘텐츠를 직접 Excel 파일로 내보내기"""
    return await _handle_direct_export("excel", request)


@router.post("/export/docx")
async def export_to_docx_direct(request: DirectExportRequest):
    """콘텐츠를 직접 Word 문서로 내보내기"""
    return await _handle_direct_export("docx", request)


@router.post("/export/pdf")
async def export_to_pdf_direct(request: DirectExportRequest):
    """콘텐츠를 직접 PDF 파일로 내보내기"""
    return await _handle_direct_export("pdf", request)


@router.post("/export/md")
async def export_to_md_direct(request: DirectExportRequest):
    """콘텐츠를 직접 마크다운 파일로 내보내기"""
    return await _handle_direct_export("md", request)


@router.post("/export/txt")
async def export_to_txt_direct(request: DirectExportRequest):
    """콘텐츠를 직접 텍스트 파일로 내보내기"""
    return await _handle_direct_export("txt", request)
