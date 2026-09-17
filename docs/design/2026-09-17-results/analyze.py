"""Prueft gespeicherte Renderer-Rechtecke; dekorative Hintergruende sind ausgenommen."""
import json
from pathlib import Path

root = Path(__file__).parent

def overlap(a, b):
    return min(a['right'], b['right']) - max(a['left'], b['left']) > 0.5 and min(a['bottom'], b['bottom']) - max(a['top'], b['top']) > 0.5

results = []
for path in sorted(root.glob('*.json')):
    if path.name == 'geometry-summary.json':
        continue
    report = json.loads(path.read_text(encoding='utf-8'))
    errors = []
    texts, buttons = report['texts'], report['buttons']
    for index, text in enumerate(texts):
        rect = text['rect']
        canvas = report['canvas']
        if rect['left'] < canvas['left'] - 0.5 or rect['right'] > canvas['right'] + 0.5:
            errors.append(f"Text ausserhalb des Canvas: {text['text']}")
        for other in texts[index + 1:]:
            if overlap(rect, other['rect']):
                errors.append(f"Textkollision: {text['text']} / {other['text']}")
        for button in buttons:
            if text['text'] != button['label'] and overlap(rect, button['rect']):
                errors.append(f"Text/Button: {text['text']} / {button['label']}")
    for index, button in enumerate(buttons):
        rect = button['rect']
        canvas = report['canvas']
        if rect['left'] < canvas['left'] - 0.5 or rect['right'] > canvas['right'] + 0.5 or rect['top'] < canvas['top'] - 0.5 or rect['bottom'] > canvas['bottom'] + 0.5:
            errors.append(f"Button ausserhalb des Canvas: {button['label']}")
        if button['rect']['height'] < 43.9:
            errors.append(f"Touchflaeche zu klein: {button['label']}")
        for other in buttons[index + 1:]:
            if overlap(button['rect'], other['rect']):
                errors.append('Buttonkollision')
    results.append({'file': path.name, 'viewport': report['viewport'],
                    'visibleTexts': len(texts), 'buttons': len(buttons),
                    'minButtonHeight': min((b['rect']['height'] for b in buttons), default=0),
                    'errors': errors})
(root / 'geometry-summary.json').write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding='utf-8')
print(json.dumps(results, indent=2, ensure_ascii=False))
raise SystemExit(1 if any(row['errors'] for row in results) else 0)
