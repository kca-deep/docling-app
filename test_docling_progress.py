"""
Docling Serve API 진행률 테스트 스크립트
API 응답에 진행률 정보가 있는지 확인
"""
import asyncio
import httpx
import json
import time
from pathlib import Path

# Docling Serve API 설정
BASE_URL = "http://kca-ai.kro.kr:8007"
ASYNC_API_URL = f"{BASE_URL}/v1/convert/file/async"
STATUS_API_URL = f"{BASE_URL}/v1/status/poll"
RESULT_API_URL = f"{BASE_URL}/v1/result"


async def test_docling_progress(pdf_path: str):
    """Docling API 진행률 테스트"""

    print("=" * 80)
    print("Docling Serve API 진행률 테스트")
    print("=" * 80)
    print()

    # PDF 파일 확인
    pdf_file = Path(pdf_path)
    if not pdf_file.exists():
        print(f"[ERROR] 파일을 찾을 수 없습니다: {pdf_path}")
        return

    print(f"[FILE] 테스트 파일: {pdf_file.name}")
    print(f"[SIZE] 파일 크기: {pdf_file.stat().st_size / 1024:.2f} KB")
    print()

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            # 1단계: 파일 업로드 및 작업 제출
            print("[STEP 1] 파일 업로드 및 작업 제출")
            print("-" * 80)

            with open(pdf_file, "rb") as f:
                files = {"files": (pdf_file.name, f, "application/pdf")}
                data = {
                    "target_type": "inbody",
                    "to_formats": ["md"],
                    "do_ocr": True,
                    "pipeline": "standard"
                }

                response = await client.post(ASYNC_API_URL, files=files, data=data)

            print(f"   응답 코드: {response.status_code}")

            if response.status_code != 200:
                print(f"[ERROR] 업로드 실패: {response.text}")
                return

            task_response = response.json()
            print(f"   응답 내용: {json.dumps(task_response, indent=2, ensure_ascii=False)}")

            task_id = task_response.get("task_id")
            if not task_id:
                print("[ERROR] Task ID를 받지 못했습니다")
                return

            print(f"[OK] Task ID: {task_id}")
            print()

            # 2단계: 상태 폴링 (진행률 확인)
            print("[STEP 2] 상태 폴링 (진행률 확인)")
            print("-" * 80)

            poll_count = 0
            max_polls = 60  # 최대 2분 (2초 간격)

            while poll_count < max_polls:
                poll_count += 1

                # 상태 조회
                status_response = await client.get(
                    f"{STATUS_API_URL}/{task_id}",
                    params={"wait": 2},
                    timeout=10.0
                )

                if status_response.status_code == 200:
                    status_data = status_response.json()

                    print(f"\n[POLL #{poll_count}] ({time.strftime('%H:%M:%S')})")
                    print(f"   전체 응답:")
                    print(json.dumps(status_data, indent=4, ensure_ascii=False))

                    # 주요 필드 추출
                    task_status = status_data.get("task_status", "unknown")
                    print(f"\n   >> task_status: {task_status}")

                    # 진행률 관련 필드 확인
                    progress_fields = [
                        "progress", "percentage", "completed", "total",
                        "completed_pages", "total_pages", "current_page",
                        "processed_pages", "remaining_pages"
                    ]

                    found_progress = False
                    for field in progress_fields:
                        if field in status_data:
                            print(f"   >> {field}: {status_data[field]}")
                            found_progress = True

                    if not found_progress:
                        print("   [INFO] 진행률 관련 필드를 찾을 수 없습니다")

                    # 작업 완료 여부 확인
                    if task_status == "success":
                        print("\n[OK] 작업 완료!")
                        break
                    elif task_status == "failure":
                        print(f"\n[ERROR] 작업 실패: {status_data}")
                        return

                else:
                    print(f"[WARN] 상태 조회 실패: {status_response.status_code}")

                await asyncio.sleep(2)

            if poll_count >= max_polls:
                print("\n[TIMEOUT] 최대 폴링 횟수 초과")
                return

            print()

            # 3단계: 결과 조회
            print("[STEP 3] 결과 조회")
            print("-" * 80)

            result_response = await client.get(f"{RESULT_API_URL}/{task_id}", timeout=30.0)

            if result_response.status_code == 200:
                result_data = result_response.json()

                print(f"   응답 키: {list(result_data.keys())}")

                if "document" in result_data:
                    doc = result_data["document"]
                    print(f"   파일명: {doc.get('filename', 'N/A')}")

                    md_content = doc.get("md_content", "")
                    print(f"   마크다운 길이: {len(md_content)} 문자")

                    if md_content:
                        preview = md_content[:200].replace("\n", " ")
                        print(f"   미리보기: {preview}...")

                print(f"   처리 시간: {result_data.get('processing_time', 'N/A')}초")
                print("\n[OK] 테스트 완료!")
            else:
                print(f"[ERROR] 결과 조회 실패: {result_response.status_code}")

        except Exception as e:
            print(f"\n[ERROR] 오류 발생: {str(e)}")
            import traceback
            traceback.print_exc()


def main():
    """메인 함수"""
    import sys

    if len(sys.argv) < 2:
        print("사용법: python test_docling_progress.py <PDF_파일_경로>")
        print()
        print("예시:")
        print("  python test_docling_progress.py sample.pdf")
        print("  python test_docling_progress.py C:\\workspace\\test.pdf")
        sys.exit(1)

    pdf_path = sys.argv[1]
    asyncio.run(test_docling_progress(pdf_path))


if __name__ == "__main__":
    main()
