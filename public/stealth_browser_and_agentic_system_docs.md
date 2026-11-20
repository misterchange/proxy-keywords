# Stealth Browser & Agentic Architecture Documentation
> **Project:** Proxy Keywords / Keyword Researcher Studio  
> **Target Scrape Sources:** Ahrefs Keyword Generator, Google Autocomplete  
> **Key Technologies:** CloakBrowser, Playwright-Core, Express, TypeScript, Server-Sent Events (SSE), SheetJS (XLSX)

---

## 1. Executive Summary & System Overview

The **Proxy Keywords Studio** is an agentic, distributed keyword intelligence engine capable of gathering high-intent search volumes and Keyword Difficulty (KD) across 150+ countries. Modern SEO platforms protect their public interfaces with strict anti-bot mechanisms (Cloudflare Turnstile, TLS/JA3 fingerprint analysis, behavioral heuristics, and React synthetic event protections).

To bypass these layers without manual human-in-the-loop intervention, the system deploys an automated **Stealth Browser Architecture** powered by **CloakBrowser** and **Playwright-Core**.

```mermaid
flowchart TD
    subgraph Client["Orchestration & UI Layer"]
        UI["Studio Dashboard / Web UI (/home)"]
        SSE["Server-Sent Events (SSE Client)"]
        Batch["CLI Batch Runner (runBatch.ts)"]
    end

    subgraph Server["Backend Orchestration (server/index.ts)"]
        Exp["Express API Server (Port 5221)"]
        RunMgr["Run State & Queue Manager"]
        Cache["In-Memory Report Cache"]
    end

    subgraph Agent["Stealth Agent Layer (cloakAhrefsGenerator.ts)"]
        Cloak["CloakBrowser / Patched Chromium Engine"]
        Context["Persistent Browser Context (.cloak-profile-*)"]
        Init["Init Scripts (navigator.webdriver cloaking)"]
        EventSim["React Prototype Event Dispatcher"]
        Poll["Adaptive DOM Stabilization Observer"]
    end

    subgraph Target["Target Endpoints & Anti-Bot Layer"]
        CF["Cloudflare Turnstile & Edge WAF"]
        DOM["Ahrefs React SPA (.ReactModalPortal)"]
    end

    subgraph Storage["Persistence & Reports"]
        XLS["Excel Matrix (.xlsx)"]
        CSV["Raw Data (.csv)"]
    end

    UI -->|Start Run| Exp
    Batch -->|CLI Run| Exp
    Exp --> RunMgr
    RunMgr -->|Broadcast Progress| SSE --> UI
    RunMgr --> Agent
    Agent --> Context
    Context --> Init
    Init --> Cloak
    Cloak -->|TLS JA3 & Clean Fingerprint| CF
    CF -->|Bypassed| DOM
    EventSim -->|Direct Prototype Injection| DOM
    DOM -->|Stabilized Rows| Poll
    Poll --> Storage
    Storage --> Cache
```

---

## 2. End-to-End Execution Sequence

This sequence diagram illustrates how a batch seed keyword request moves from ingestion to file persistence without triggering Cloudflare challenges:

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Batch Runner
    participant Server as Express Server (index.ts)
    participant Agent as CloakBrowser Agent
    participant Chrome as Patched Chromium Context
    participant Target as Ahrefs / Cloudflare
    participant Storage as File Exporter (sheet.ts)

    User->>Server: POST /api/run { targetFile, batch, limit }
    Server->>Agent: Spawn lookup(seed, country)
    Agent->>Chrome: launchPersistentContext(userDataDir, args)
    Note over Chrome: Suppress --enable-automation<br/>Inject window.chrome & clean webdriver
    Chrome->>Target: HTTPS GET (Ahrefs Keyword Generator)
    Note over Target,Chrome: Cloudflare evaluates JA3/JA4 TLS handshake & headers
    Target-->>Chrome: 200 OK (Render React Application)
    Agent->>Chrome: Evaluate: dismiss GDPR/Cookie banners
    Agent->>Chrome: Prototype Descriptor Set: HTMLInputElement.value
    Agent->>Chrome: Dispatch bubbling 'input' event (React Fiber sync)
    Agent->>Chrome: Click "Find keywords" button
    loop Adaptive Polling (Stabilization Loop)
        Agent->>Chrome: Query .ReactModalPortal table row count
        Chrome-->>Agent: Count unchanged for >= 2 cycles
    end
    Agent->>Chrome: Click "Questions" tab & repeat extraction
    Agent-->>Server: Return { PhraseMatch: rows, Questions: rows }
    Server->>Storage: Checkpoint write (.xlsx / .csv)
    Server-->>User: SSE broadcast { progress, keywordsFound, logs }
```

---

## 3. Deep-Dive: The 4 Core Anti-Detection Pillars

### Pillar 1: Patched Chromium Binary & Profile Persistence

```mermaid
flowchart LR
    subgraph Vanilla["Standard Playwright/Chromium"]
        V1["Vanilla Node.js / Playwright"] -->|Exposes default TLS| V2["Uncommon JA3 Fingerprint"]
        V2 -->|Fails Bot Heuristic| V3["Cloudflare 403 / Turnstile Challenge"]
        V4["Ephemeral Blank Context"] -->|Zero Cache & Cookies| V3
    end

    subgraph Cloak["CloakBrowser Persistent Setup"]
        C1["Patched Chromium Binary"] -->|Matches Retail Chrome| C2["Legitimate JA3/JA4 TLS Signature"]
        C3["launchPersistentContext()"] -->|Maintains Cookies, Storage & Cache| C4["Trusted Returning User Footprint"]
        C2 & C4 -->|Passes Cleanly| C5["Direct 200 OK / Turnstile Bypass"]
    end
```

#### Why Naive Scraping Fails:
Standard Playwright downloads a headless Chromium binary. During the TLS handshake, its cipher suite ordering, extensions, and elliptic curve formats generate a recognizable signature (known as JA3 or JA4 fingerprint). Cloudflare's Edge inspects this packet before HTTP parsing begins. If the JA3 matches known automated tools, a blocking Turnstile challenge is immediately presented.

#### How Our Architecture Solves It:
1. **Patched Engine:** The project references `.cloakbrowser/chromium-146.0.7680.177.5/chrome.exe`. This binary is recompiled to mirror commercial Google Chrome's network and cipher profiles.
2. **Persistent Context:** `chromium.launchPersistentContext(userDataDir, ...)` maintains an ongoing disk store of session data. This saves `cf_clearance` cookies, TLS session tickets, and IndexedDB state, ensuring the browser is identified as a persistent returning desktop device.

---

### Pillar 2: Flag Suppression & Fingerprint Cloaking

```mermaid
flowchart TD
    subgraph Detection["Browser Inspection Traps"]
        T1["navigator.webdriver == true?"]
        T2["window.chrome undefined or missing runtime?"]
        T3["Blink AutomationControlled active?"]
    end

    subgraph Cloaking["Our Multi-Tier Injections"]
        I1["page.addInitScript: Object.defineProperty(navigator, 'webdriver', { get: () => undefined })"]
        I2["page.addInitScript: window.chrome = { runtime: {} }"]
        I3["args: --disable-blink-features=AutomationControlled"]
        I4["ignoreDefaultArgs: ['--enable-automation']"]
    end

    subgraph Result["Security Outcome"]
        R1["Anti-bot script reads undefined -> PASSED"]
        R2["Window check confirms Chrome -> PASSED"]
        R3["No automation infobar or CDP tags -> PASSED"]
    end

    I1 --> R1
    I2 --> R2
    I3 & I4 --> R3
```

#### Code Implementation in `cloakAhrefsGenerator.ts`:
```typescript
context = await chromium.launchPersistentContext(userDataDir, {
  executablePath,
  headless: false,
  ignoreDefaultArgs: ['--enable-automation'],
  args: [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--start-maximized',
  ],
  viewport: null,
});

const page = context.pages()[0] || (await context.newPage());

await page.addInitScript(() => {
  // 1. Mask webdriver
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  // 2. Polyfill chrome runtime
  (window as any).chrome = (window as any).chrome || { runtime: {} };
});
```

* **`--disable-blink-features=AutomationControlled`**: Prevents Blink from attaching automated driver hooks to window and document prototypes.
* **`page.addInitScript`**: Guarantees overrides execute in the execution context *prior* to any remote script loading from `ahrefs.com` or Cloudflare CDN.

---

### Pillar 3: Natural Human Event Emulation & React Fiber State Sync

```mermaid
flowchart TD
    subgraph Naive["Naive DOM Approach (Fails)"]
        N1["input.value = 'keyword'"]
        N2["React SyntheticEvent not notified"]
        N3["Internal Virtual DOM state = ''"]
        N4["Click submit -> Form sends empty request"]
        N1 --> N2 --> N3 --> N4
    end

    subgraph Native["Our Prototype Injection Flow"]
        P1["Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set"]
        P2["Bypasses React's wrapper setter directly"]
        P3["input.dispatchEvent(new Event('input', { bubbles: true }))"]
        P4["React root listener captures bubbling event"]
        P5["Virtual DOM reconciles state = 'keyword'"]
        P6["Submit button fires with populated query payload"]
        P1 --> P2 --> P3 --> P4 --> P5 --> P6
    end
```

#### The Controlled Component Dilemma:
Modern web applications written in React (such as Ahrefs) intercept standard input element setters. Setting `.value` directly modifies the HTML attribute in the DOM tree, but leaves React's internal **Fiber node** un-updated. When the user clicks the submit button, React reads from its internal state and sends an empty string.

#### Our Solution:
1. Extract the native browser setter: `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set`.
2. Apply it directly to the target element instance: `.call(input, keyword)`.
3. Dispatch a real DOM event with bubbling enabled: `new Event('input', { bubbles: true })`. React’s top-level event delegation picks up this bubbling event and updates its Fiber state seamlessly.

---

### Pillar 4: Rate Limiting, Cooldowns & Jitter

```mermaid
sequenceDiagram
    participant Agent as Batch Runner
    participant Edge as Cloudflare Edge PoP (Leaky Bucket)

    Note over Edge: Capacity: 10 tokens | Refill: 1 token / 3 sec
    Agent->>Edge: Query 1: Seed "protein powder" [US] (Token consumed)
    Note over Agent: Minimum wait BETWEEN_SEEDS_MS = 3000ms
    Edge-->>Agent: 200 OK (Data returned)
    Note over Edge: Token refilled (+1)
    Agent->>Edge: Query 2: Seed "protein powder" [UK] (Token consumed)
    Edge-->>Agent: 200 OK (Data returned)
    Note over Edge: Leaky Bucket never overflows -> Zero Challenges Triggered
```

#### Behavioral Analysis Defense:
Cloudflare tracks request arrival distributions over time. 
* **Static Timers (e.g. exactly 1000ms):** Highly detectable via Fourier analysis / periodicity detectors.
* **Burst Traffic:** Consumes the token bucket instantly, tripping immediate Cloudflare Managed Challenges or rate limits.

#### Our Mitigation:
We enforce a dynamic cooldown floor (`BETWEEN_SEEDS_MS = 3000`) calculated from the previous lookup timestamp (`lastLookupAt`), paired with natural DOM polling time variations. This introduces organic jitter and ensures operations remain comfortably below edge burst thresholds.

---

## 5. Adaptive DOM Polling & Tab Extraction

Rather than using unstable, hardcoded `sleep()` statements, the extraction agent uses a **stabilization detector**:

```mermaid
stateDiagram-v2
    [*] --> FormSubmitted: Click Find Keywords
    FormSubmitted --> DetectPortal: Await .ReactModalPortal
    DetectPortal --> ParseRows: Extract Current Table Cells
    ParseRows --> CheckStability: Compare with lastCount
    CheckStability --> ParseRows: Row count changed (still rendering)
    CheckStability --> Stabilized: Row count unchanged for 2 cycles
    Stabilized --> SwitchTab: Click Questions Tab
    SwitchTab --> ParseQuestions: Extract Questions Table
    ParseQuestions --> Export: Merge & Persist Data
    Export --> [*]
```

---

## 6. Interview Quick Reference Sheet

| Question | Winning Answer Summary |
| :--- | :--- |
| **"How does the stealth browser work?"** | *"It combines a custom-compiled Chromium binary that matches retail Google Chrome's JA3/JA4 TLS signature with Playwright's persistent context. We strip automation flags, mask `navigator.webdriver` via `addInitScript`, and polyfill `window.chrome` before any page script executes."* |
| **"Why not use Puppeteer or standard Playwright?"** | *"Standard Playwright leaks WebDriver flags and has a unique vanilla Chromium TLS fingerprint that Cloudflare Edge detects immediately, triggering unbreakable Turnstile challenges."* |
| **"How do you automate inputs in modern React apps?"** | *"React uses controlled components. Directly assigning `input.value` fails because React's Fiber state remains empty. We grab the native setter from `HTMLInputElement.prototype`, invoke it directly, and dispatch a bubbling `input` event to force React's state synchronization."* |
| **"How do you manage scaling and IP bans?"** | *"We enforce a 3-second cooldown window between requests to maintain leaky-bucket rate limits at the Cloudflare Edge, coupled with incremental checkpointing to disk so batches can resume seamlessly upon interruption."* |
