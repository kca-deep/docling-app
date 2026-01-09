"""
Function Calling 도구 정의
LLM이 호출할 수 있는 도구(함수) 스키마를 정의합니다.
"""

from typing import List, Dict, Any

# 채팅에서 사용할 도구 목록
CHAT_EXPORT_TOOLS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "export_to_excel",
            "description": "데이터나 분석 결과를 엑셀(.xlsx) 파일로 내보내기합니다. 표 형태의 데이터, CSV 형식, 또는 구조화된 텍스트를 엑셀로 변환합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "data": {
                        "type": "string",
                        "description": "내보낼 데이터. CSV 형식(콤마 구분), 테이블 형식(| 구분), 또는 줄바꿈으로 구분된 텍스트"
                    },
                    "filename": {
                        "type": "string",
                        "description": "저장할 파일명 (확장자 제외). 기본값: 'export'"
                    },
                    "sheet_name": {
                        "type": "string",
                        "description": "엑셀 시트 이름. 기본값: 'Sheet1'"
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
            "description": "텍스트 내용을 Word(.docx) 문서로 내보내기합니다. 마크다운 형식의 텍스트를 Word 문서로 변환합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "문서에 포함할 내용. 마크다운 형식 지원 (제목, 목록, 표 등)"
                    },
                    "title": {
                        "type": "string",
                        "description": "문서 제목. 기본값: '문서'"
                    },
                    "filename": {
                        "type": "string",
                        "description": "저장할 파일명 (확장자 제외). 기본값: 'document'"
                    }
                },
                "required": ["content"]
            }
        }
    }
]


def get_chat_tools(enable_excel: bool = True, enable_docx: bool = True) -> List[Dict[str, Any]]:
    """
    활성화된 도구 목록 반환

    Args:
        enable_excel: 엑셀 내보내기 도구 활성화
        enable_docx: DOCX 내보내기 도구 활성화

    Returns:
        활성화된 도구 스키마 목록
    """
    tools = []

    for tool in CHAT_EXPORT_TOOLS:
        func_name = tool["function"]["name"]
        if func_name == "export_to_excel" and enable_excel:
            tools.append(tool)
        elif func_name == "export_to_docx" and enable_docx:
            tools.append(tool)

    return tools


def get_tool_names() -> List[str]:
    """등록된 모든 도구 이름 반환"""
    return [tool["function"]["name"] for tool in CHAT_EXPORT_TOOLS]


def get_tool_by_name(name: str) -> Dict[str, Any] | None:
    """이름으로 도구 스키마 조회"""
    for tool in CHAT_EXPORT_TOOLS:
        if tool["function"]["name"] == name:
            return tool
    return None
