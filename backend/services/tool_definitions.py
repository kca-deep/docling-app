"""
Function Calling 도구 정의
LLM이 호출할 수 있는 도구(함수) 스키마를 정의합니다.

하이브리드 의도 감지 방식:
- 사전 필터(might_be_export_request)가 가능성 있으면 tools 활성화
- LLM이 description을 보고 최종 판단하여 적절한 도구 호출
- description이 명확해야 LLM이 정확히 판단 가능
"""

from typing import List, Dict, Any

# 채팅에서 사용할 도구 목록
# LLM이 정확히 판단할 수 있도록 description을 상세하게 작성
CHAT_EXPORT_TOOLS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "export_to_excel",
            "description": """엑셀(.xlsx) 파일로 내보내기 도구.
[호출 조건] 사용자가 이전 답변/대화 내용을 엑셀 파일로 저장/다운로드/내보내기를 명시적으로 요청할 때만 호출.
[호출 안함] 일반 질문, 정보 검색, 엑셀 '사용법'에 대한 질문에는 호출하지 않음.
[예시 호출] "엑셀로 저장해", "xlsx로 다운로드", "Excel 파일로 내보내기", "스프레드시트로 만들어줘"
[예시 미호출] "엑셀 함수 알려줘", "엑셀이 뭐야?", "xlsx 파일 여는 법" """,
            "parameters": {
                "type": "object",
                "properties": {
                    "data": {
                        "type": "string",
                        "description": "이전 답변의 전체 내용 (원본 그대로, 생략/요약 금지)"
                    },
                    "filename": {
                        "type": "string",
                        "description": "파일명 (확장자 제외). 기본값: 'export'"
                    }
                },
                "required": ["data"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "export_to_docx",
            "description": """워드(.docx) 파일로 내보내기 도구.
[호출 조건] 사용자가 이전 답변/대화 내용을 워드 파일로 저장/다운로드/내보내기를 명시적으로 요청할 때만 호출.
[호출 안함] 일반 질문, 정보 검색, 워드 '사용법'에 대한 질문에는 호출하지 않음.
[예시 호출] "워드로 저장해", "docx로 다운로드", "Word 파일로", "문서파일로 만들어줘"
[예시 미호출] "워드 단축키 알려줘", "docx가 뭐야?" """,
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "이전 답변의 전체 내용 (원본 그대로, 생략/요약 금지)"
                    },
                    "filename": {
                        "type": "string",
                        "description": "파일명 (확장자 제외). 기본값: 'document'"
                    }
                },
                "required": ["content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "export_to_pdf",
            "description": """PDF 파일로 내보내기 도구.
[호출 조건] 사용자가 이전 답변/대화 내용을 PDF 파일로 저장/다운로드/내보내기를 명시적으로 요청할 때만 호출.
[호출 안함] 일반 질문, 정보 검색, PDF '뷰어/편집기'에 대한 질문에는 호출하지 않음.
[예시 호출] "PDF로 저장해", "pdf 파일로 다운로드", "피디에프로 내보내기"
[예시 미호출] "PDF 편집하는 법", "PDF가 뭐야?" """,
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "이전 답변의 전체 내용 (원본 그대로, 생략/요약 금지)"
                    },
                    "filename": {
                        "type": "string",
                        "description": "파일명 (확장자 제외). 기본값: 'document'"
                    }
                },
                "required": ["content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "export_to_md",
            "description": """마크다운(.md) 파일로 내보내기 도구.
[호출 조건] 사용자가 이전 답변/대화 내용을 마크다운 파일로 저장/다운로드/내보내기를 명시적으로 요청할 때만 호출.
[호출 안함] 일반 질문, 정보 검색, 마크다운 '문법/사용법'에 대한 질문에는 호출하지 않음.
[예시 호출] "md로 저장해", "마크다운 파일로 다운로드", "markdown으로", "md파일로 내보내기", ".md로 뽑아줘"
[예시 미호출] "마크다운 문법 알려줘", "md 파일이 뭐야?", "markdown 작성법" """,
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "이전 답변의 전체 내용 (원본 그대로, 생략/요약 금지)"
                    },
                    "filename": {
                        "type": "string",
                        "description": "파일명 (확장자 제외). 기본값: 'export'"
                    }
                },
                "required": ["content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "export_to_txt",
            "description": """텍스트(.txt) 파일로 내보내기 도구.
[호출 조건] 사용자가 이전 답변/대화 내용을 텍스트 파일로 저장/다운로드/내보내기를 명시적으로 요청할 때만 호출.
[호출 안함] 일반 질문, 정보 검색에는 호출하지 않음. "텍스트" 단독 언급은 내보내기 의도가 아님.
[예시 호출] "txt로 저장해", "텍스트 파일로 다운로드", "txt파일로 내보내기", "plain text로"
[예시 미호출] "텍스트 편집기 추천", "txt 파일 여는 법" """,
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "이전 답변의 전체 내용 (원본 그대로, 생략/요약 금지)"
                    },
                    "filename": {
                        "type": "string",
                        "description": "파일명 (확장자 제외). 기본값: 'export'"
                    }
                },
                "required": ["content"]
            }
        }
    }
]


def get_chat_tools(
    enable_excel: bool = True,
    enable_docx: bool = True,
    enable_pdf: bool = True,
    enable_md: bool = True,
    enable_txt: bool = True
) -> List[Dict[str, Any]]:
    """
    활성화된 도구 목록 반환

    Args:
        enable_excel: 엑셀 내보내기 도구 활성화
        enable_docx: DOCX 내보내기 도구 활성화
        enable_pdf: PDF 내보내기 도구 활성화
        enable_md: 마크다운 내보내기 도구 활성화
        enable_txt: 텍스트 내보내기 도구 활성화

    Returns:
        활성화된 도구 스키마 목록
    """
    tools = []
    tool_flags = {
        "export_to_excel": enable_excel,
        "export_to_docx": enable_docx,
        "export_to_pdf": enable_pdf,
        "export_to_md": enable_md,
        "export_to_txt": enable_txt
    }

    for tool in CHAT_EXPORT_TOOLS:
        func_name = tool["function"]["name"]
        if tool_flags.get(func_name, False):
            tools.append(tool)

    return tools


def get_tool_by_format(format_type: str) -> List[Dict[str, Any]]:
    """
    특정 형식의 도구만 반환 (P2: 선택적 활성화용)

    Args:
        format_type: 형식 타입 (excel, docx, pdf, md, txt)

    Returns:
        해당 형식의 도구 스키마 리스트
    """
    format_to_tool = {
        "excel": "export_to_excel",
        "docx": "export_to_docx",
        "pdf": "export_to_pdf",
        "md": "export_to_md",
        "txt": "export_to_txt"
    }

    tool_name = format_to_tool.get(format_type)
    if not tool_name:
        return []

    for tool in CHAT_EXPORT_TOOLS:
        if tool["function"]["name"] == tool_name:
            return [tool]

    return []


def get_tool_names() -> List[str]:
    """등록된 모든 도구 이름 반환"""
    return [tool["function"]["name"] for tool in CHAT_EXPORT_TOOLS]


def get_tool_by_name(name: str) -> Dict[str, Any] | None:
    """이름으로 도구 스키마 조회"""
    for tool in CHAT_EXPORT_TOOLS:
        if tool["function"]["name"] == name:
            return tool
    return None
