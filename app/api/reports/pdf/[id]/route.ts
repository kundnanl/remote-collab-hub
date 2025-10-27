import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { createCaller } from "@/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const { orgId } = await auth();
  if (!orgId) return notFound();

  const caller = await createCaller();
  const run = await caller.reports.getRun({ orgId, runId: id });

  if (!run || run.orgId !== orgId || run.status !== "READY" || !run.html) {
    return new Response(JSON.stringify({ error: "Report not found or not ready" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isLocal = process.env.NODE_ENV !== "production";

  const browser = await puppeteer.launch(
    isLocal
      ? {
          headless: true,
          executablePath:
            process.platform === "win32"
              ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
              : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        }
      : {
          args: chromium.args,
          executablePath: await chromium.executablePath(),
          headless: true,
        }
  );

  const page = await browser.newPage();
  await page.setContent(run.html, { waitUntil: "networkidle0" });

  const bodyHeight = await page.evaluate(() => document.body.scrollHeight);

  const pdfBuffer = await page.pdf({
    width: "210mm",
    height: `${bodyHeight}px`,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });

  await browser.close();

  const fileName = `${run.id}.pdf`;

  return new Response(Buffer.from(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
