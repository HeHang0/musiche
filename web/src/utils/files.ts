interface SpecialService {
  MouseDownDrag: () => void;
  ResizeWindow: (direction: number) => void;
  ReleaseMouse: () => void;
}

export const webView2Services = {
  specialService: null
} as {
  specialService: SpecialService | null;
};

try {
  webView2Services.specialService = (
    window as any
  )?.chrome?.webview?.hostObjects?.sync.specialService;
} catch (error) {}
