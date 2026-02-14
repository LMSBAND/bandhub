"""Audio processing service - peak computation for waveform rendering."""

import io
import struct
import numpy as np


def compute_peaks(audio_data: bytes, num_peaks: int = 800) -> list[float]:
    """Compute waveform peaks from raw audio data.

    Adapted from FlightRecordingAnalyzer's _compute_peaks pattern.
    Takes raw audio bytes, decodes to samples, and computes
    downsampled peak values for waveform visualization.
    """
    try:
        from pydub import AudioSegment

        audio = AudioSegment.from_file(io.BytesIO(audio_data))
        # Convert to mono
        if audio.channels > 1:
            audio = audio.set_channels(1)

        samples = np.array(audio.get_array_of_samples(), dtype=np.float32)

        if len(samples) == 0:
            return [0.0] * num_peaks

        # Normalize to -1..1
        max_val = np.max(np.abs(samples))
        if max_val > 0:
            samples = samples / max_val

        # Downsample to target number of peaks
        chunk_size = max(1, len(samples) // num_peaks)
        peaks = []
        for i in range(0, len(samples), chunk_size):
            chunk = samples[i : i + chunk_size]
            peaks.append(float(np.max(np.abs(chunk))))

        # Trim or pad to exact count
        if len(peaks) > num_peaks:
            peaks = peaks[:num_peaks]
        while len(peaks) < num_peaks:
            peaks.append(0.0)

        return peaks

    except Exception:
        # Return flat line on error
        return [0.0] * num_peaks


def get_duration(audio_data: bytes) -> float:
    """Get duration in seconds from audio data."""
    try:
        from pydub import AudioSegment

        audio = AudioSegment.from_file(io.BytesIO(audio_data))
        return audio.duration_seconds
    except Exception:
        return 0.0
