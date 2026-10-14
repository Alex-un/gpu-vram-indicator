# GPU VRAM Indicator

A GNOME Shell extension that shows NVIDIA VRAM usage in the top bar and lets you click it for per-process details.

## Features

- **Top-bar indicator** — a small label in the panel (top-right) showing current VRAM, e.g. `GPU 8.1G/16.0G`.
- **Click for details** — clicking the indicator opens a menu with:
  - GPU model name
  - Utilization (%)
  - Temperature (°C)
  - VRAM used / total (with percentage)
  - Power draw (W)
  - Per-process VRAM usage (sorted, descending)
- **Live updates** — refreshes every 2 seconds.
- **Aligned** — the label is vertically centered with the other panel items (uses the same `clutter_text.y_align = CENTER` technique GNOME's own clock uses).

## Requirements

- GNOME Shell 46.0
- `nvidia-smi` on `PATH` (NVIDIA driver installed)

## Install

```bash
git clone https://github.com/Alex-un/gpu-vram-indicator.git
cp -r gpu-vram-indicator ~/.local/share/gnome-shell/extensions/gpu-vram-indicator@yori.local
# log out and back in, or press Alt+F2, type "r", Enter (X11)
```

Then enable it with **Extension Manager** or `gnome-extensions enable gpu-vram-indicator@yori.local`.

## Files

| File | Purpose |
|------|---------|
| `extension.js` | The extension code |
| `metadata.json` | Extension metadata (uuid, name, shell-version) |

## Notes

- Reads data via `nvidia-smi` (subprocess), no privileged access needed.
- The indicator sits in the panel's right box, position 1 (just left of the system icons).
