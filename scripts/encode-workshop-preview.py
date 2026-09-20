"""Cut actual workbench footage into a square overview/detail GIF for Workshop."""
import bisect
import json
from pathlib import Path
from PIL import Image, ImageDraw

root = Path('reference/workshop-preview')
frames = json.loads((root / 'frames.json').read_text('utf-8'))
images = [Image.open(root / f['file']).convert('RGB') for f in frames]
times = [f['time'] for f in frames]
# duration, source start/end ms, crop center x/y, crop size start/end.
# Full views retain the whole widescreen composition with black letterboxing.
shots = [
    (1800, 2507, 4500, 640, 360, 1280, 1280),
    (2400, 4500, 5900, 240, 307, 465, 435),
    (2400, 7000, 10200, 1040, 338, 465, 435),
    (2000, 12000, 14300, 640, 360, 1280, 1280),
    (2000, 14300, 16200, 1040, 338, 465, 435),
    (2600, 18800, 22269, 640, 360, 1280, 1280),
]
output = []
contact = Image.new('RGB', (960, 696), '#242424')
draw = ImageDraw.Draw(contact)
for shot_index, (duration, begin, end, cx, cy, initial, final) in enumerate(shots):
    for t in range(0, duration, 100):
        progress = t / duration
        source_time = begin + (end - begin) * progress
        index = max(0, min(len(images) - 1, bisect.bisect_right(times, source_time) - 1))
        ease = progress * progress * (3 - 2 * progress)
        size = initial + (final - initial) * ease
        crop = images[index].crop((round(cx - size / 2), round(cy - size / 2), round(cx + size / 2), round(cy + size / 2)))
        output.append(crop.resize((640, 640), Image.Resampling.LANCZOS))
        if t == 0:
            x, y = shot_index % 3 * 320, shot_index // 3 * 348
            contact.paste(output[-1].resize((320, 320), Image.Resampling.LANCZOS), (x, y))
            draw.text((x + 8, y + 326), f'Shot {shot_index + 1} / {duration / 1000:.1f}s', fill='white')
contact.save(root / 'storyboard.jpg')

for filename, size in [('wallpaper/preview.gif', (256, 256)), ('reference/workshop-preview/workbench-preview.gif', (640, 640))]:
    resized = [image.resize(size, Image.Resampling.LANCZOS) for image in output]
    sample = Image.new('RGB', (size[0], size[1] * 12))
    for i in range(12):
        sample.paste(resized[min(len(resized) - 1, i * len(resized) // 12)], (0, i * size[1]))
    palette = sample.quantize(colors=24 if size[0] == 256 else 96)
    indexed = [image.quantize(palette=palette, dither=Image.Dither.NONE) for image in resized]
    indexed[0].save(filename, save_all=True, append_images=indexed[1:], duration=100, loop=0, optimize=True, disposal=1)
    file = Path(filename)
    check = Image.open(file)
    print(filename, file.stat().st_size, 'bytes', check.n_frames, 'encoded frames', len(output) * 100, 'ms')
    if filename == 'wallpaper/preview.gif':
        assert file.stat().st_size < 1_000_000
        assert check.n_frames > 1 and check.size == (256, 256)
