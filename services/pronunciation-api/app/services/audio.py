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


def read_mono_pcm16(path: Path) -> tuple[int, list[int]]:
    with wave.open(str(path), 'rb') as wav:
        if wav.getnchannels() != 1 or wav.getsampwidth() != 2:
            raise ValueError('expected mono 16-bit wav')

        sample_rate = wav.getframerate()
        frames = wav.readframes(wav.getnframes())

    samples = [
        int.from_bytes(frames[i:i + 2], byteorder='little', signed=True)
        for i in range(0, len(frames), 2)
    ]
    return sample_rate, samples
