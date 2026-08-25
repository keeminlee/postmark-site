const { chromium } = await import("file:///G:/Wright-HQ/node_modules/playwright/index.mjs");
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
const ROOT = "G:/postmark/wt-fund/dist-town";
const T = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript", ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".webp":"image/webp", ".json":"application/json", ".woff2":"font/woff2" };
const s = createServer((req,res)=>{ let p=decodeURIComponent(req.url.split("?")[0]); let f=join(ROOT,p); if(existsSync(f)&&statSync(f).isDirectory())f=join(f,"index.html"); if(!existsSync(f)){res.writeHead(404);return res.end("nf");} res.writeHead(200,{"content-type":T[extname(f)]??"application/octet-stream"}); res.end(readFileSync(f)); });
await new Promise(r=>s.listen(4322,r));
const b = await chromium.launch();
const page = await b.newPage({ viewport:{width:1280,height:1400}, deviceScaleFactor:2 });
for (const pot of ["keeping-ec2","darko-fund"]) {
  await page.goto(`http://127.0.0.1:4322/fund/${pot}/`, { waitUntil:"networkidle" });
  await page.locator(".f-qr").screenshot({ path:`G:/postmark/wt-fund/qa-shots/qr-${pot}.png` });
}
await b.close(); s.close(); console.log("qr shots written");
