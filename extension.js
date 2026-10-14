import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const INDICATOR_ID = 'gpu-vram';
const REFRESH_MS = 2000;
const NVSMI = '/usr/bin/nvidia-smi';
const GPU_QUERY = ['--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw', '--format=csv,noheader'];
const APPS_QUERY = ['--query-compute-apps=pid,process_name,used_memory', '--format=csv,noheader'];

function num(text, suffix) {
    const m = new RegExp(`([\\d.]+)\\s*${suffix}`).exec(text || '');
    return m ? parseFloat(m[1]) : null;
}

function baseName(p) {
    const parts = p.split('/');
    return parts[parts.length - 1] || p;
}

function fmtMiB(v) {
    if (v == null) return 'N/A';
    return v >= 1024 ? `${(v / 1024).toFixed(1)}G` : `${Math.round(v)}M`;
}

function runQuery(args) {
    try {
        const proc = Gio.Subprocess.new([NVSMI, ...args], Gio.SubprocessFlags.STDOUT_PIPE);
        const [ok, stdout] = proc.communicate(null, null);
        return ok ? new TextDecoder().decode(stdout.get_data()) : null;
    } catch (e) {
        return null;
    }
}

function parseLines(text) {
    return text ? text.split('\n').map(x => x.trim()).filter(Boolean) : [];
}

function collect() {
    const gpuOut = runQuery(GPU_QUERY);
    if (!gpuOut) return null;
    const lines = parseLines(gpuOut);
    if (!lines.length) return null;
    const parts = lines[0].split(',').map(s => s.trim());
    const gpu = {
        name: parts[0],
        util: num(parts[1], '%'),
        memUsed: num(parts[2], 'MiB'),
        memTotal: num(parts[3], 'MiB'),
        temp: num(parts[4], ''),  // csv,noheader 输出裸数字，如 '48'
        power: num(parts[5], 'W'),
    };
    const procs = [];
    for (const line of parseLines(runQuery(APPS_QUERY))) {
        const p = line.split(',').map(s => s.trim());
        if (p.length < 3) continue;
        procs.push({ name: baseName(p[1]), mem: num(p[2], 'MiB') });
    }
    procs.sort((a, b) => (b.mem ?? 0) - (a.mem ?? 0));
    return { gpu, procs };
}

function makeRow(text, bold = false) {
    const l = new St.Label({ text });
    if (bold) l.set_style('font-weight: bold; padding-bottom: 4px;');
    return l;
}

export default class GpuVramIndicator extends Extension {
    enable() {
        this._indicator = new PanelMenu.Button(-1, 'GPU VRAM');
        this._label = new St.Label({ text: 'GPU —', style_class: 'panel-status-menu-label' });
        // 标签被拉伸到顶栏全高，clutter_text 默认顶部对齐会让文字比同行高；
        // GNOME 自己的时钟就是这么居中处理的
        this._label.clutter_text.y_align = Clutter.ActorAlign.CENTER;
        this._indicator.add_child(this._label);
        Main.panel.addToStatusArea(INDICATOR_ID, this._indicator, 1);

        this._content = new St.BoxLayout({ vertical: true });
        this._content.set_style('min-width: 320px; padding: 4px;');
        this._indicator.setMenu(new PopupMenu.PopupMenu(this._indicator, 0.0, St.Side.TOP));
        this._indicator.menu.box.add_child(this._content);

        this._indicator.menu.connect('open-state-changed',
            (menu, open) => { if (open) this._refresh(); });
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, REFRESH_MS, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
        this._refresh();
    }

    _refresh() {
        this._redraw(collect());
    }

    _redraw(data) {
        this._content.destroy_all_children();
        if (!data) {
            this._label.text = 'GPU —';
            this._content.add_child(makeRow('nvidia-smi unavailable'));
            return;
        }
        const { gpu, procs } = data;
        this._label.text = `GPU ${fmtMiB(gpu.memUsed)}/${fmtMiB(gpu.memTotal)}`;

        this._content.add_child(makeRow(gpu.name, true));
        this._content.add_child(makeRow(`Utilization:  ${gpu.util != null ? gpu.util + '%' : 'N/A'}`));
        this._content.add_child(makeRow(`Temperature: ${gpu.temp != null ? gpu.temp + ' °C' : 'N/A'}`));
        this._content.add_child(makeRow(
            `VRAM:       ${fmtMiB(gpu.memUsed)} / ${fmtMiB(gpu.memTotal)}` +
            (gpu.memTotal ? ` (${Math.round(100 * gpu.memUsed / gpu.memTotal)}%)` : '')));
        this._content.add_child(makeRow(
            `Power:      ${gpu.power != null ? gpu.power.toFixed(2) + ' W' : 'N/A'}`));
        this._content.add_child(makeRow(''));
        this._content.add_child(makeRow(`Processes (${procs.length})`, true));
        if (!procs.length) {
            this._content.add_child(makeRow('  (none using GPU)'));
        }
        for (const p of procs) {
            this._content.add_child(makeRow(`  ${p.name}  —  ${p.mem != null ? p.mem + ' MiB' : 'N/A'}`));
        }
    }

    disable() {
        if (this._timer) GLib.source_remove(this._timer);
        if (this._indicator) {
            Main.panel.statusArea[INDICATOR_ID] = null;
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
