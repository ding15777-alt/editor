"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, CircleHelp, Download, Film, Image as ImageIcon, LoaderCircle, Play, Plus, RefreshCw, SlidersHorizontal, Sparkles, Upload, WandSparkles, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Tool = "video" | "image";
type Mode = "standard" | "first-last";
type UploadSlotProps = { label: string; hint: string; preview?: string; onPick: (file: File) => void; onClear: () => void; compact?: boolean };

const effects = ["None", "Orbit", "Dolly in", "Gentle blink", "Wind sweep"];
const aspectRatios = ["1:1", "4:3", "3:4", "16:9", "9:16"];

function taskIdFrom(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) return value.map(taskIdFrom).find(Boolean);
  const record = value as Record<string, unknown>;
  if (typeof record._id === "string") return record._id;
  if (typeof record.id === "string") return record.id;
  return Object.values(record).map(taskIdFrom).find(Boolean);
}

function taskStatusFrom(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) return value.map(taskStatusFrom).find(Boolean);
  const record = value as Record<string, unknown>;
  for (const key of ["current_status", "status", "state"]) {
    if (typeof record[key] === "string") return record[key] as string;
  }
  return Object.values(record).map(taskStatusFrom).find(Boolean);
}

function mediaUrlsFrom(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(mediaUrlsFrom);
  const record = value as Record<string, unknown>;
  const direct = Object.entries(record).flatMap(([key, item]) =>
    /(?:url|video|image|result|output)/i.test(key) && typeof item === "string" && /^https?:\/\//.test(item) ? [item] : []
  );
  return [...direct, ...Object.values(record).flatMap(mediaUrlsFrom)];
}

function UploadSlot({ label, hint, preview, onPick, onClear, compact }: UploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={`upload-slot group relative overflow-hidden ${compact ? "min-h-[210px]" : "min-h-[390px]"}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file?.type.startsWith("image/")) onPick(file); }}>
      <input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) onPick(file); }} />
      {preview ? <>
        {/* Local object URLs are intentional here: this is the user's upload preview. */}
        <img src={preview} alt={`${label} preview`} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/15" />
        <span className="absolute bottom-4 left-4 rounded-full bg-black/45 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md">{label}</span>
        <Button type="button" size="icon-sm" variant="secondary" className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/45 text-white shadow-none hover:bg-black/70" onClick={onClear} aria-label={`Remove ${label.toLowerCase()}`}><X /></Button>
      </> : <button type="button" className="absolute inset-0 flex w-full flex-col items-center justify-center px-6 text-center" onClick={() => inputRef.current?.click()}>
        <span className="mb-5 grid size-14 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white transition group-hover:scale-105 group-hover:bg-white/[0.1]"><Upload className="size-5" /></span>
        <span className="text-base font-semibold text-white">{label}</span>
        <span className="mt-1 max-w-56 text-sm leading-6 text-zinc-400">{hint}</span>
        <span className="mt-5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300">PNG, JPG or WebP · 20MB max</span>
      </button>}
    </div>
  );
}

function FieldLabel({ children, help }: { children: React.ReactNode; help?: string }) {
  return <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-200">{children}{help && <Tooltip><TooltipTrigger asChild><button type="button" className="text-zinc-600 transition hover:text-zinc-300" aria-label="More information"><CircleHelp className="size-3.5" /></button></TooltipTrigger><TooltipContent sideOffset={7} className="max-w-64 bg-zinc-100 text-zinc-900">{help}</TooltipContent></Tooltip>}</div>;
}

export function Studio() {
  const [tool, setTool] = useState<Tool>("video");
  const [mode, setMode] = useState<Mode>("standard");
  const [startFile, setStartFile] = useState<File>();
  const [endFile, setEndFile] = useState<File>();
  const [referenceFile, setReferenceFile] = useState<File>();
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("blurry, low quality, distorted details, watermark");
  const [effect, setEffect] = useState("None");
  const [duration, setDuration] = useState(5);
  const [addAudio, setAddAudio] = useState(true);
  const [model, setModel] = useState("a2e-v2-flash");
  const [imageModel, setImageModel] = useState("a2e");
  const [ratio, setRatio] = useState("16:9");
  const [resolution, setResolution] = useState("2K");
  const [imageCount, setImageCount] = useState("1");
  const [advanced, setAdvanced] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "queued" | "error">("idle");
  const [message, setMessage] = useState("");
  const [resultUrl, setResultUrl] = useState<string>();
  const [resultKind, setResultKind] = useState<Tool>();

  const startPreview = useMemo(() => (startFile ? URL.createObjectURL(startFile) : undefined), [startFile]);
  const endPreview = useMemo(() => (endFile ? URL.createObjectURL(endFile) : undefined), [endFile]);
  const referencePreview = useMemo(() => (referenceFile ? URL.createObjectURL(referenceFile) : undefined), [referenceFile]);

  useEffect(() => () => { if (startPreview) URL.revokeObjectURL(startPreview); if (endPreview) URL.revokeObjectURL(endPreview); if (referencePreview) URL.revokeObjectURL(referencePreview); }, [startPreview, endPreview, referencePreview]);

  useEffect(() => {
    type ModelContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => unknown }, options: { signal: AbortSignal }) => void | Promise<void> };
    const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(modelContext.registerTool({
      name: "configure_motionroom_generation",
      title: "Configure a Motionroom generation",
      description: "Set the visible studio mode and generation prompt without submitting a paid task or uploading media.",
      inputSchema: { type: "object", properties: { tool: { type: "string", enum: ["video", "image"] }, prompt: { type: "string", minLength: 1, maxLength: 2000 } }, required: ["tool", "prompt"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const value = input as { tool?: unknown; prompt?: unknown };
        if ((value.tool !== "video" && value.tool !== "image") || typeof value.prompt !== "string" || !value.prompt.trim()) throw new Error("Provide a tool and a non-empty prompt.");
        setTool(value.tool); setPrompt(value.prompt.trim()); setStatus("idle");
        return { tool: value.tool, promptConfigured: true, submitted: false };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const canGenerate = prompt.trim().length > 0 && (tool !== "video" || Boolean(startFile)) && (mode !== "first-last" || Boolean(endFile));

  async function upload(file: File) {
    if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) throw new Error("Choose a PNG, JPG, or WebP image under 20MB.");
    const response = await fetch("/api/a2e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upload-url", name: file.name, contentType: file.type, size: file.size }),
    });
    const data = await response.json() as { error?: string; uploadUrl?: string; cdnUrl?: string };
    if (!response.ok) throw new Error(data.error || "Could not prepare the upload.");
    if (!data.uploadUrl || !data.cdnUrl) throw new Error("The upload URL response was incomplete.");
    const put = await fetch(data.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!put.ok) throw new Error("The image upload was rejected.");
    return data.cdnUrl;
  }

  async function generate() {
    if (!canGenerate || status === "loading") return;
    setStatus("loading");
    setResultUrl(undefined);
    setMessage(tool === "video" ? "Uploading your starting frame…" : "Preparing your image request…");
    try {
      let action: "generate-video" | "generate-image";
      let payload: Record<string, unknown>;
      if (tool === "video") {
        const imageUrl = await upload(startFile!);
        const endImageUrl = mode === "first-last" && endFile ? await upload(endFile) : undefined;
        action = "generate-video";
        payload = {
          name: "Motionroom video",
          image_url: imageUrl,
          end_image_url: endImageUrl,
          prompt: effect === "None" ? prompt : `${prompt}. Creative direction: ${effect}.`,
          negative_prompt: negativePrompt,
          generation_mode: "image-to-video",
          model_type: mode === "first-last" ? "FLF2V" : "GENERAL",
          model_version: model,
          auto_add_audio: addAudio,
          extend_prompt: true,
          number_of_images: 1,
          video_time: duration,
        };
      } else {
        const imageUrl = referenceFile ? await upload(referenceFile) : undefined;
        const [modelType, modelVersion] = imageModel.startsWith("seedream-")
          ? ["seedream", imageModel.replace("seedream-", "")]
          : [imageModel, undefined];
        action = "generate-image";
        payload = {
          name: "Motionroom image",
          prompt,
          model_type: modelType,
          ...(modelVersion ? { model_version: modelVersion } : {}),
          ...(imageUrl ? { input_images: [imageUrl] } : {}),
          aspect_ratio: ratio,
          resolution,
          max_images: Number(imageCount),
        };
      }
      setMessage("Submitting your generation…");
      const response = await fetch("/api/a2e", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
      const data = await response.json() as unknown;
      if (!response.ok) throw new Error((data as { error?: string }).error || "The generation request could not be submitted.");
      const id = taskIdFrom(data);
      setStatus("queued");
      setMessage(id ? `Task ${id.slice(-6)} is queued. This page will check for the finished render.` : "Your generation has been submitted. Check My generations for the result.");
      if (id) {
        const kind = tool;
        const poll = window.setInterval(async () => {
          try {
            const detail = await fetch(`/api/a2e?action=status&kind=${kind}&id=${encodeURIComponent(id)}`).then((item) => item.json() as Promise<unknown>);
            const urls = mediaUrlsFrom(detail);
            const current = taskStatusFrom(detail)?.toLowerCase();
            if (urls[0]) { window.clearInterval(poll); setResultUrl(urls[0]); setResultKind(kind); setStatus("ready"); setMessage("Your render is ready."); }
            else if (current?.includes("fail")) { window.clearInterval(poll); setStatus("error"); setMessage("This task did not complete. Review the prompt and try again."); }
          } catch { /* Keep the task visible; the next poll may succeed. */ }
        }, 5000);
        window.setTimeout(() => window.clearInterval(poll), 300000);
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  function resetWorkspace() { setStartFile(undefined); setEndFile(undefined); setReferenceFile(undefined); setPrompt(""); setStatus("idle"); setMessage(""); setResultUrl(undefined); }

  return <TooltipProvider><main className="studio-shell min-h-screen text-zinc-100">
    <header className="topbar">
      <a href="#studio" className="brand" aria-label="Motionroom studio home"><span className="brand-mark"><Play className="ml-0.5 size-3.5 fill-current" /></span><span>Motionroom</span><span className="beta-pill">STUDIO</span></a>
      <nav className="hidden items-center gap-7 text-sm text-zinc-400 md:flex" aria-label="Primary navigation"><a className="text-white" href="#studio">Create</a><a className="transition hover:text-white" href="#recent">My generations</a></nav>
      <div className="flex items-center gap-3"><span className="hidden items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400 sm:flex"><span className="size-1.5 rounded-full bg-amber-300" /> Preview mode</span><button className="avatar-button" type="button" aria-label="Open account menu">G</button></div>
    </header>

    <section id="studio" className="workspace-wrap">
      <div className="workspace-heading"><div><p className="eyebrow">CREATIVE STUDIO</p><h1>Turn an idea into a moving frame.</h1></div><Button type="button" variant="ghost" className="rounded-full text-zinc-400 hover:bg-white/[0.06] hover:text-white" onClick={resetWorkspace}><RefreshCw /> Reset</Button></div>
      <Tabs value={tool} onValueChange={(value) => { setTool(value as Tool); setStatus("idle"); }} className="gap-0">
        <TabsList className="tool-tabs" aria-label="Creation tool"><TabsTrigger value="video" className="tool-tab"><Film /> Image to video</TabsTrigger><TabsTrigger value="image" className="tool-tab"><ImageIcon /> Text to image</TabsTrigger></TabsList>

        <TabsContent value="video" className="mt-0"><div className="studio-grid">
          <section className="canvas-panel" aria-label="Image upload workspace"><div className="canvas-toolbar"><div className="mode-switch" role="group" aria-label="Video generation mode"><button type="button" className={mode === "standard" ? "active" : ""} onClick={() => setMode("standard")}>Standard</button><button type="button" className={mode === "first-last" ? "active" : ""} onClick={() => setMode("first-last")}>First + last frame</button></div><span className="hidden text-xs text-zinc-500 sm:block">Drop an image anywhere in the frame</span></div>
            {mode === "standard" ? <UploadSlot label="Upload your starting frame" hint="Use a clear, well-lit image for the most natural motion." preview={startPreview} onPick={setStartFile} onClear={() => setStartFile(undefined)} /> : <div className="grid gap-3 lg:grid-cols-2"><UploadSlot compact label="Starting frame" hint="Where the motion begins." preview={startPreview} onPick={setStartFile} onClear={() => setStartFile(undefined)} /><UploadSlot compact label="Ending frame" hint="Where the motion lands." preview={endPreview} onPick={setEndFile} onClear={() => setEndFile(undefined)} /></div>}
            <div className="canvas-note"><Zap className="size-4 text-lime-300" /><span>{mode === "standard" ? "Best for natural movement and camera direction." : "Keep the subject at a similar scale in both frames."}</span></div>
          </section>
          <aside className="controls-panel" aria-label="Video generation settings">
            <div className="panel-heading"><div><p className="panel-kicker">DIRECTION</p><h2>Describe the motion</h2></div><span className="step-number">01</span></div>
            <label><FieldLabel help="Describe subject action, camera movement, and atmosphere.">Prompt</FieldLabel><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A slow cinematic push-in as the subject turns toward the light, soft wind moving through the scene…" rows={5} /></label>
            <div><FieldLabel>Creative direction</FieldLabel><div className="effect-row">{effects.map((item) => <button type="button" key={item} className={effect === item ? "active" : ""} onClick={() => setEffect(item)}>{item}</button>)}</div></div>
            <button type="button" className="advanced-toggle" onClick={() => setAdvanced((value) => !value)}><span><SlidersHorizontal className="size-4" /> Advanced direction</span><ChevronDown className={`size-4 transition ${advanced ? "rotate-180" : ""}`} /></button>
            {advanced && <label className="animate-reveal"><FieldLabel>Negative prompt</FieldLabel><textarea className="compact-textarea" value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} rows={2} /></label>}
            <div className="divider" />
            <div className="settings-grid"><label><FieldLabel>Model</FieldLabel><Select value={model} onValueChange={setModel}><SelectTrigger className="select-control"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a2e-v2-flash">A2E V2 Flash</SelectItem><SelectItem value="a2e-v2">A2E V2</SelectItem><SelectItem value="a2e">A2E Classic</SelectItem></SelectContent></Select></label><label><FieldLabel>Duration</FieldLabel><div className="duration-control"><Slider value={[duration]} min={5} max={20} step={5} onValueChange={(value) => setDuration(value[0])} /><span>{duration}s</span></div></label></div>
            <div className="audio-row"><div><span>Generate audio</span><small>Native sound for supported V2 models</small></div><Switch checked={addAudio} onCheckedChange={setAddAudio} aria-label="Generate audio" /></div>
            <Button type="button" size="lg" className="generate-button" disabled={!canGenerate || status === "loading"} onClick={generate}>{status === "loading" ? <LoaderCircle className="animate-spin" /> : <WandSparkles />}{status === "loading" ? "Preparing…" : "Generate video"}{status !== "loading" && <ArrowRight className="ml-auto" />}</Button>
            {!canGenerate && <p className="required-note">Add a starting frame and prompt to continue.</p>}
          </aside>
        </div></TabsContent>

        <TabsContent value="image" className="mt-0"><div className="studio-grid image-layout">
          <section className="image-prompt-panel"><div className="panel-heading"><div><p className="panel-kicker">COMPOSITION</p><h2>What do you want to see?</h2></div><span className="step-number">01</span></div><label><FieldLabel help="Include style, composition, lighting, and important details.">Image prompt</FieldLabel><textarea className="image-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A fashion portrait in a brutalist gallery, late afternoon light, restrained editorial styling, shot on 35mm…" rows={8} /></label><div><FieldLabel help="A reference image can guide composition, subject, or visual style.">Reference image <span className="text-zinc-600">(optional)</span></FieldLabel><div className="reference-row">{referencePreview ? <div className="reference-thumb"><img src={referencePreview} alt="Reference upload preview" /><button type="button" onClick={() => setReferenceFile(undefined)} aria-label="Remove reference"><X /></button></div> : <label className="reference-add"><Plus /><span>Add reference</span><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setReferenceFile(event.target.files?.[0])} /></label>}<p>Use up to two references with Auto, or up to ten with Seedream 5 Pro.</p></div></div></section>
          <aside className="controls-panel" aria-label="Image generation settings"><div className="panel-heading compact-heading"><div><p className="panel-kicker">OUTPUT</p><h2>Image settings</h2></div><span className="step-number">02</span></div><div className="stacked-settings"><label><FieldLabel>Model</FieldLabel><Select value={imageModel} onValueChange={setImageModel}><SelectTrigger className="select-control"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a2e">Auto select</SelectItem><SelectItem value="seedream-4.5">Seedream 4.5</SelectItem><SelectItem value="seedream-5.0">Seedream 5.0</SelectItem><SelectItem value="seedream-5.0-pro">Seedream 5.0 Pro</SelectItem><SelectItem value="zimage">Z-Image Turbo</SelectItem></SelectContent></Select></label><div><FieldLabel>Aspect ratio</FieldLabel><div className="ratio-row">{aspectRatios.map((item) => <button key={item} type="button" className={ratio === item ? "active" : ""} onClick={() => setRatio(item)}>{item}</button>)}</div></div><div className="settings-grid"><label><FieldLabel>Resolution</FieldLabel><Select value={resolution} onValueChange={setResolution}><SelectTrigger className="select-control"><SelectValue /></SelectTrigger><SelectContent>{["1K", "1080P", "2K", "3K", "4K"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label><label><FieldLabel>Outputs</FieldLabel><Select value={imageCount} onValueChange={setImageCount}><SelectTrigger className="select-control"><SelectValue /></SelectTrigger><SelectContent>{["1", "2", "4", "8"].map((item) => <SelectItem key={item} value={item}>{item} image{item !== "1" ? "s" : ""}</SelectItem>)}</SelectContent></Select></label></div></div>
            <Button type="button" size="lg" className="generate-button mt-auto" disabled={!prompt.trim() || status === "loading"} onClick={generate}>{status === "loading" ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{status === "loading" ? "Composing…" : "Generate images"}<ArrowRight className="ml-auto" /></Button>{!prompt.trim() && <p className="required-note">Describe an image to continue.</p>}</aside>
        </div></TabsContent>
      </Tabs>
      {status !== "idle" && <section className={`status-card ${status}`} aria-live="polite"><div className="status-icon">{status === "loading" ? <LoaderCircle className="animate-spin" /> : status === "error" ? <X /> : <Check />}</div><div><p>{status === "loading" ? "Starting generation" : status === "queued" ? "Generation queued" : status === "error" ? "Generation needs attention" : "Render ready"}</p><span>{message}</span></div>{(status === "ready" || status === "error") && <Button variant="outline" size="sm" className="ml-auto border-white/10 bg-transparent text-zinc-200" onClick={() => setStatus("idle")}>Dismiss</Button>}</section>}
    </section>
    <section id="recent" className="recent-strip" aria-label="Recent generations">{resultUrl ? <><div><p className="panel-kicker">LATEST RENDER</p><h2>Ready to review.</h2></div><div className="result-card">{resultKind === "video" ? <video controls src={resultUrl} /> : <img src={resultUrl} alt="Generated result" />}<a href={resultUrl} target="_blank" rel="noreferrer"><Download /> Download</a></div></> : <><div><p className="panel-kicker">RECENT</p><h2>Your next render will appear here.</h2></div><div className="recent-empty"><span><Download /></span><p>Generated images and videos stay easy to review and download.</p></div></>}</section>
  </main></TooltipProvider>;
}
