import { copyFile, mkdir } from 'node:fs/promises';

const output = new URL('./dist/', import.meta.url);
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'tournament.js', 'scheduler.js', 'scheduler-worker.js', 'storage.js', 'statistics.js']) {
  await copyFile(new URL(file, import.meta.url), new URL(file, output));
}
