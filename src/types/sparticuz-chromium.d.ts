declare module "@sparticuz/chromium" {
  interface ChromiumDefaultViewport {
    width: number;
    height: number;
    deviceScaleFactor: number;
    isMobile: boolean;
    hasTouch: boolean;
    isLandscape: boolean;
  }

  const chromium: {
    args: string[];
    defaultViewport: ChromiumDefaultViewport;
    executablePath(path?: string): Promise<string>;
    headless: boolean;
  };

  export default chromium;
}
