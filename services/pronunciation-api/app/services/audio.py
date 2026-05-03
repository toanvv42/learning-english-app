import subprocess
import wave
from pathlib import Path


def convert_to_wav(input_path: Path, output_path: Path) -> None:
    subprocess.run([
        'ffmpeg', '-y', '-i', str(input_path), '-ac', '1', '-ar', '16000', str(output_path)
    ], check=True, capture_output=True)


def get_duration_seconds(path: Path) -> float:
    with wave.open(str(path), 'rb') as wav:
        return wav.getnframes() / float(wav.getframerate())
