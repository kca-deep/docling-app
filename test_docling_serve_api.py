"""
Docling Serve API 연결 테스트 스크립트
docu 폴더의 PDF 파일을 Docling Serve API로 전송하여 파싱 테스트
"""

import sys
from pathlib import Path
import requests
import json
import traceback

# 프로젝트 루트 경로 추가
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))


def test_docling_serve_api():
    """Docling Serve API를 사용하여 PDF 파일 파싱 테스트 (비동기 방식)"""

    # API 설정
    base_url = "http://kca-ai.kro.kr:8007"
    async_api_url = f"{base_url}/v1/convert/file/async"
    status_api_url = f"{base_url}/v1/status/poll"
    result_api_url = f"{base_url}/v1/result"

    # 테스트할 PDF 파일 목록
    pdf_files = [
        project_root / "docu" / "sample.pdf",
        project_root / "docu" / "sample2.pdf",
        project_root / "docu" / "sample3.pdf"
    ]

    print("\n" + "="*80)
    print("[INFO] Docling Serve API 파싱 테스트 시작 (비동기 방식)")
    print("="*80)

    for pdf_path in pdf_files:
        if not pdf_path.exists():
            print(f"\n[ERROR] 파일을 찾을 수 없습니다: {pdf_path}")
            continue

        print(f"\n{'='*80}")
        print(f"[INFO] 파싱 중: {pdf_path.name}")
        print(f"[INFO] 파일 크기: {pdf_path.stat().st_size:,} bytes")
        print(f"{'='*80}")

        try:
            # 1단계: 비동기 변환 작업 시작
            with open(pdf_path, 'rb') as f:
                files = {'files': (pdf_path.name, f, 'application/pdf')}

                # API 요청 파라미터
                data = {
                    'target_type': 'inbody',
                }

                print(f"[INFO] 비동기 변환 작업 시작...")
                print(f"[INFO] API URL: {async_api_url}")

                # 비동기 API 호출
                response = requests.post(
                    async_api_url,
                    files=files,
                    data=data,
                    timeout=60
                )

                print(f"[INFO] 응답 상태 코드: {response.status_code}")

                if response.status_code == 200:
                    task_response = response.json()
                    print(f"[INFO] Task 응답: {task_response}")

                    if 'task_id' in task_response:
                        task_id = task_response['task_id']
                        print(f"[INFO] Task ID: {task_id}")

                        # 2단계: Task 상태 폴링 (타임아웃 없음)
                        import time
                        poll_interval = 2
                        elapsed = 0

                        print(f"[INFO] Task 완료 대기 중...")

                        while True:
                            status_response = requests.get(
                                f"{status_api_url}/{task_id}",
                                params={'wait': poll_interval},
                                timeout=poll_interval + 5
                            )

                            if status_response.status_code == 200:
                                status_data = status_response.json()
                                status = status_data.get('task_status', 'unknown')
                                print(f"[INFO] Task 상태: {status} (경과 시간: {elapsed}초)")

                                if status == 'success':
                                    print(f"[SUCCESS] Task 완료!")
                                    break
                                elif status == 'failure':
                                    print(f"[ERROR] Task 실패: {status_data}")
                                    break
                            else:
                                print(f"[WARNING] 상태 확인 실패: {status_response.status_code}")

                            time.sleep(poll_interval)
                            elapsed += poll_interval

                        # 3단계: 결과 조회
                        print(f"[INFO] 결과 조회 중...")
                        result_response = requests.get(
                            f"{result_api_url}/{task_id}",
                            timeout=30
                        )

                        if result_response.status_code == 200:
                            result = result_response.json()

                            # 결과 분석 및 저장
                            if isinstance(result, dict):
                                print(f"\n[SUCCESS] 파싱 성공!")

                                # API 응답 구조 확인
                                if 'document' in result:
                                    doc = result['document']
                                    print(f"\n--- 문서 정보 ---")
                                    print(f"  파일명: {doc.get('filename', 'N/A')}")
                                    print(f"  처리 시간: {result.get('processing_time', 0):.2f}초")

                                    # 마크다운 내용 저장
                                    if 'md_content' in doc and doc['md_content']:
                                        markdown_content = doc['md_content']
                                        output_file = project_root / "docu" / f"{pdf_path.stem}_api_output.md"

                                        with open(output_file, 'w', encoding='utf-8') as out_f:
                                            out_f.write(markdown_content)

                                        print(f"  마크다운 길이: {len(markdown_content):,} 자")
                                        print(f"  마크다운 라인 수: {len(markdown_content.splitlines()):,} 줄")
                                        print(f"  저장 위치: {output_file}")

                                    # JSON 형식으로도 저장
                                    json_output_file = project_root / "docu" / f"{pdf_path.stem}_api_output.json"
                                    with open(json_output_file, 'w', encoding='utf-8') as json_f:
                                        json.dump(doc, json_f, ensure_ascii=False, indent=2)
                                    print(f"  JSON 저장 위치: {json_output_file}")

                                # 전체 응답 저장
                                full_output_file = project_root / "docu" / f"{pdf_path.stem}_api_full_response.json"
                                with open(full_output_file, 'w', encoding='utf-8') as full_f:
                                    json.dump(result, full_f, ensure_ascii=False, indent=2)
                                print(f"\n[INFO] 전체 응답 저장 위치: {full_output_file}")

                            else:
                                print(f"[WARNING] 예상치 못한 응답 형식: {type(result)}")
                                print(f"응답 내용: {str(result)[:500]}")

                        else:
                            print(f"[ERROR] 결과 조회 실패")
                            print(f"응답 코드: {result_response.status_code}")
                            print(f"응답 내용: {result_response.text[:500]}")

                    else:
                        print(f"[ERROR] Task ID를 받지 못했습니다: {task_response}")

                else:
                    print(f"[ERROR] API 호출 실패")
                    print(f"응답 코드: {response.status_code}")
                    print(f"응답 내용: {response.text[:500]}")

        except requests.exceptions.Timeout:
            print(f"[ERROR] API 요청 타임아웃 (120초 초과)")
            traceback.print_exc()

        except requests.exceptions.RequestException as e:
            print(f"[ERROR] API 요청 중 오류 발생: {e}")
            traceback.print_exc()

        except Exception as e:
            print(f"[ERROR] 예상치 못한 오류 발생: {e}")
            traceback.print_exc()

    print(f"\n{'='*80}")
    print("[INFO] Docling Serve API 테스트 완료")
    print(f"{'='*80}\n")


if __name__ == "__main__":
    test_docling_serve_api()
