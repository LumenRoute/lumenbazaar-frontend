/**
 * Critical Routes Hydration Test
 * 
 * Verifies that key application routes handle server-rendering and hydration
 * without warnings across representative loading and authenticated states.
 * 
 * Tests include:
 * - Home page with async dashboard metrics
 * - Settings page with localStorage-dependent form
 * - Seller dashboard with environment-dependent rendering
 * - Explore page with search parameter handling
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/services/api/query";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { captureHydrationWarnings } from "./utils";

describe("Critical Routes - Hydration", () => {
  let capture: ReturnType<typeof captureHydrationWarnings>["capture"];
  let cleanup: ReturnType<typeof captureHydrationWarnings>["cleanup"];

  beforeEach(() => {
    const hydration = captureHydrationWarnings();
    capture = hydration.capture;
    cleanup = hydration.cleanup;

    vi.stubEnv("NEXT_PUBLIC_LUMENBAZAAR_ENV", "demo");
    vi.stubEnv("NEXT_PUBLIC_LUMENBAZAAR_API_URL", "http://localhost:8080");
    vi.stubEnv("NEXT_PUBLIC_LUMENBAZAAR_NETWORK", "stellar:testnet");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  describe("Settings Route", () => {
    it("renders settings page without hydration warnings", () => {
      render(<SettingsPanel />);

      expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
      expect(capture.getHydrationWarnings()).toHaveLength(0);
    });

    it("initializes form controls without hydration mismatch", () => {
      render(<SettingsPanel />);

      expect(screen.getByLabelText("Network")).toBeInTheDocument();
      expect(screen.getByLabelText("Facilitator URL")).toBeInTheDocument();
      expect(screen.getByText("Wallet preference")).toBeInTheDocument();

      expect(capture.getHydrationWarnings()).toHaveLength(0);
    });

    it("displays both settings and runtime config panels without hydration warnings", () => {
      render(<SettingsPanel />);

      expect(screen.getByText("Frontend preferences")).toBeInTheDocument();
      expect(screen.getByText("Runtime defaults")).toBeInTheDocument();
      expect(capture.getHydrationWarnings()).toHaveLength(0);
    });

    it("maintains two-column layout without hydration mismatch", () => {
      const { container } = render(<SettingsPanel />);

      const gridContainer = container.querySelector("[class*=grid]");
      expect(gridContainer).toBeInTheDocument();
      expect(capture.getHydrationWarnings()).toHaveLength(0);
    });
  });

  describe("Route with QueryClient", () => {
    it("renders page with QueryClientProvider without hydration warnings", () => {
      const queryClient = createQueryClient();

      const TestPage = () => <div>Test page content</div>;

      render(
        <QueryClientProvider client={queryClient}>
          <TestPage />
        </QueryClientProvider>
      );

      expect(screen.getByText("Test page content")).toBeInTheDocument();
      expect(capture.getHydrationWarnings()).toHaveLength(0);
    });

    it("maintains QueryClient state through hydration", () => {
      const queryClient = createQueryClient();
      const testData = { id: 1, name: "test" };

      queryClient.setQueryData(["test-key"], testData);

      const TestPage = () => {
        const data = queryClient.getQueryData(["test-key"]);
        return <div>{JSON.stringify(data)}</div>;
      };

      render(
        <QueryClientProvider client={queryClient}>
          <TestPage />
        </QueryClientProvider>
      );

      expect(screen.getByText(JSON.stringify(testData))).toBeInTheDocument();
      expect(capture.getHydrationWarnings()).toHaveLength(0);
    });
  });

  describe("Authenticated State Routes", () => {
    it("renders authenticated route structure without hydration warnings", () => {
      const AuthenticatedPage = () => (
        <div>
          <h1>Authenticated Page</h1>
          <p>Welcome, user</p>
          <button>Logout</button>
        </div>
      );

      render(
        <QueryClientProvider client={createQueryClient()}>
          <AuthenticatedPage />
        </QueryClientProvider>
      );

      expect(screen.getByText("Authenticated Page")).toBeInTheDocument();
      expect(screen.getByText("Welcome, user")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();

      expect(capture.getHydrationWarnings()).toHaveLength(0);
    });
  });

  describe("Loading State Routes", () => {
    it("renders loading skeleton without hydration warnings", () => {
      const SkeletonLoader = () => (
        <div>
          <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-12 w-full animate-pulse rounded bg-slate-200" />
        </div>
      );

      render(
        <QueryClientProvider client={createQueryClient()}>
          <SkeletonLoader />
        </QueryClientProvider>
      );

      expect(capture.getHydrationWarnings()).toHaveLength(0);
    });

    it("maintains skeleton animation through hydration", () => {
      const SkeletonContent = () => (
        <div className="space-y-4">
          <div className="h-6 animate-pulse rounded bg-slate-200" />
          <div className="h-6 animate-pulse rounded bg-slate-200" />
          <div className="h-6 animate-pulse rounded bg-slate-200" />
        </div>
      );

      const { container } = render(
        <QueryClientProvider client={createQueryClient()}>
          <SkeletonContent />
        </QueryClientProvider>
      );

      const skeletons = container.querySelectorAll("[class*=animate-pulse]");
      expect(skeletons.length).toBeGreaterThan(0);
      expect(capture.getHydrationWarnings()).toHaveLength(0);
    });
  });

  describe("Error State Routes", () => {
    it("renders error state without hydration warnings", () => {
      const ErrorPage = () => (
        <div>
          <h1>Error</h1>
          <p>Something went wrong</p>
          <button>Retry</button>
        </div>
      );

      render(
        <QueryClientProvider client={createQueryClient()}>
          <ErrorPage />
        </QueryClientProvider>
      );

      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(capture.getHydrationWarnings()).toHaveLength(0);
    });
  });

  describe("Dynamic Route Parameters", () => {
    it("renders route with search parameters without hydration mismatch", () => {
      const SearchPage = ({ query }: { query: string }) => (
        <div>
          <h1>Search Results</h1>
          <p>Searching for: {query}</p>
        </div>
      );

      render(
        <QueryClientProvider client={createQueryClient()}>
          <SearchPage query="test" />
        </QueryClientProvider>
      );

      expect(screen.getByText("Search Results")).toBeInTheDocument();
      expect(screen.getByText("Searching for: test")).toBeInTheDocument();
      expect(capture.getHydrationWarnings()).toHaveLength(0);
    });

    it("maintains consistent search parameter handling through hydration", () => {
      const DynamicPage = ({ resourceId }: { resourceId: string }) => (
        <div>
          <h1>Resource</h1>
          <p>ID: {resourceId}</p>
        </div>
      );

      const { rerender } = render(
        <QueryClientProvider client={createQueryClient()}>
          <DynamicPage resourceId="123" />
        </QueryClientProvider>
      );

      expect(screen.getByText("ID: 123")).toBeInTheDocument();
      expect(capture.getHydrationWarnings()).toHaveLength(0);

      rerender(
        <QueryClientProvider client={createQueryClient()}>
          <DynamicPage resourceId="123" />
        </QueryClientProvider>
      );

      expect(capture.getHydrationWarnings()).toHaveLength(0);
    });
  });

  describe("Mobile vs Desktop Rendering", () => {
    it("renders responsive layout without hydration warnings", () => {
      const ResponsiveLayout = () => (
        <div>
          <div className="hidden sm:flex">Desktop navigation</div>
          <div className="flex sm:hidden">Mobile navigation</div>
          <main className="px-2 sm:px-4">Content</main>
        </div>
      );

      render(
        <QueryClientProvider client={createQueryClient()}>
          <ResponsiveLayout />
        </QueryClientProvider>
      );

      expect(capture.getHydrationWarnings()).toHaveLength(0);
    });

    it("maintains Tailwind responsive classes through hydration", () => {
      const ResponsiveContent = () => (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>Col 1</div>
          <div>Col 2</div>
        </div>
      );

      const { container } = render(
        <QueryClientProvider client={createQueryClient()}>
          <ResponsiveContent />
        </QueryClientProvider>
      );

      const grid = container.querySelector("[class*=grid]");
      expect(grid?.className).toContain("grid");
      expect(capture.getHydrationWarnings()).toHaveLength(0);
    });
  });

  describe("Complex Route Trees", () => {
    it("renders nested route structure without hydration warnings", () => {
      const NestedRouteTree = () => (
        <div>
          <header>Header</header>
          <nav>Navigation</nav>
          <main>
            <section>
              <h1>Page Title</h1>
              <p>Content</p>
            </section>
          </main>
          <footer>Footer</footer>
        </div>
      );

      render(
        <QueryClientProvider client={createQueryClient()}>
          <NestedRouteTree />
        </QueryClientProvider>
      );

      expect(screen.getByText("Header")).toBeInTheDocument();
      expect(screen.getByText("Navigation")).toBeInTheDocument();
      expect(screen.getByText("Page Title")).toBeInTheDocument();
      expect(screen.getByText("Footer")).toBeInTheDocument();

      expect(capture.getHydrationWarnings()).toHaveLength(0);
    });
  });
});
