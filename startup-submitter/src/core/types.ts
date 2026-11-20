export interface StartupProfile {
  startup: {
    name: string;
    url: string;
    tagline: string;
    descriptionShort: string;
    descriptionLong: string;
    category: string;
    pricingModel: string;
    tags: string[];
    twitterUrl?: string;
    githubUrl?: string;
  };
  founder: {
    name: string;
    email: string;
    password?: string;
    location?: string;
  };
  assets?: {
    logoPath?: string;
    screenshotPath?: string;
  };
  settings?: {
    headless?: boolean;
    delayBetweenSitesMs?: number;
    solveCaptcha?: boolean;
    twoCaptchaApiKey?: string;
  };
}

export interface DirectoryInfo {
  id: string;
  name: string;
  url: string;
  type: 'direct-form' | 'account-required' | 'contact-form' | 'reddit';
  notes?: string;
}

export interface SubmissionResult {
  directoryId: string;
  directoryName: string;
  targetUrl: string;
  status: 'SUBMITTED' | 'ACCOUNT_CREATED' | 'NEEDS_VERIFICATION' | 'CAPTCHA_BLOCKED' | 'FAILED' | 'SKIPPED';
  message: string;
  proofScreenshot?: string;
  timestamp: string;
}

