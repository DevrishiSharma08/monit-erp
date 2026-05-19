const SO_KEY = "monit_emailSent_so";
const PO_KEY = "monit_emailSent_po";

function read<T>(key: string): Set<T> {
  try {
    const v = localStorage.getItem(key);
    return new Set<T>(v ? JSON.parse(v) : []);
  } catch { return new Set<T>(); }
}

function write<T>(key: string, ids: Set<T>) {
  try { localStorage.setItem(key, JSON.stringify([...ids])); } catch {}
}

export const emailSentCache = {
  getSoIds(): Set<string>  { return read<string>(SO_KEY); },
  getPoIds(): Set<number>  { return read<number>(PO_KEY); },
  addSoId(id: string)  { const s = read<string>(SO_KEY); s.add(id); write(SO_KEY, s); },
  addPoId(id: number)  { const s = read<number>(PO_KEY); s.add(id); write(PO_KEY, s); },
  seedPoIds(ids: number[]) { const s = read<number>(PO_KEY); ids.forEach(id => s.add(id)); write(PO_KEY, s); },
};
