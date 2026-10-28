import { describe, expect, it } from "vitest";

import {
  bunVersion,
  composeEnv,
  defaultLabels,
  dockerfileArgs,
  imageName,
  parseLabels,
  parseOptions,
  parseRegistration,
  planUp,
  projectName,
  removeTargets,
  repoFromRemote,
  runnerName,
  runsOnValue,
  UsageError,
  workerFromName,
} from "./runner-plan";

describe("parseOptions", () => {
  it("parses runner:up", () => {
    expect(
      parseOptions([
        "up",
        "--workers",
        "3",
        "--repo",
        "o/n",
        "--labels",
        "a, b,a",
        "--dry-run",
      ])
    ).toEqual({
      command: "up",
      repo: "o/n",
      workers: 3,
      labels: ["a", "b"],
      worker: [],
      all: false,
      dryRun: true,
    });
  });

  it("defaults repo and labels to undefined (derived later)", () => {
    const options = parseOptions(["up", "--workers", "1"]);
    expect(options.repo).toBeUndefined();
    expect(options.labels).toBeUndefined();
    expect(options.dryRun).toBe(false);
  });

  it("collects --worker for remove, sorted and unique", () => {
    expect(
      parseOptions([
        "remove",
        "--worker",
        "3",
        "--worker",
        "1",
        "--worker",
        "3",
      ]).worker
    ).toEqual([1, 3]);
  });

  it.each([
    [[], /command must be one of/],
    [["start"], /command must be one of/],
    [["up"], /needs --workers/],
    [["up", "--workers", "0"], /--workers must be/],
    [["up", "--workers", "two"], /--workers must be/],
    [["up", "--workers", "17"], /--workers must be/],
    [["up", "--workers", "1", "--repo", "nope"], /owner\/name/],
    [["up", "--workers", "1", "--labels", " , "], /at least one label/],
    [["up", "--workers", "1", "--labels", "a b"], /invalid label/],
    [["up", "--workers", "1", "--all"], /--all does not apply/],
    [["down", "--workers", "2"], /--workers does not apply/],
    [["remove"], /either --worker <n> or --all/],
    [["remove", "--all", "--worker", "1"], /either --worker <n> or --all/],
    [["logs", "extra"], /unexpected argument/],
  ])("rejects %j", (argv, message) => {
    expect(() => parseOptions(argv)).toThrow(message);
  });

  it("throws UsageError for usage mistakes", () => {
    expect(() => parseOptions(["up"])).toThrow(UsageError);
  });
});

describe("parseLabels", () => {
  it("refuses self-hosted (GitHub adds it)", () => {
    expect(() => parseLabels("self-hosted,x")).toThrow(/added by GitHub/);
  });
});

describe("repoFromRemote", () => {
  it.each([
    [
      "git@github.com:flooper68/cloudflare-starter.git",
      "flooper68/cloudflare-starter",
    ],
    [
      "https://github.com/flooper68/cloudflare-starter",
      "flooper68/cloudflare-starter",
    ],
    ["https://github.com/o/my.repo.git", "o/my.repo"],
    ["ssh://git@github.com/o/n.git/", "o/n"],
  ])("%s → %s", (url, repo) => {
    expect(repoFromRemote(url)).toBe(repo);
  });

  it("returns undefined for other hosts", () => {
    expect(repoFromRemote("git@gitlab.com:o/n.git")).toBeUndefined();
  });
});

describe("names", () => {
  it("are unique per repository and worker", () => {
    expect(projectName("Flooper68/cloudflare-starter", 2)).toBe(
      "flooper68-cloudflare-starter-runner-2"
    );
    expect(imageName("o/My_Repo")).toBe("o-my-repo-runner:local");
  });

  it("names runners after the host, repository and worker", () => {
    expect(runnerName("MacBook-Pro.local", "o/cloudflare-starter", 1)).toBe(
      "macbook-pro-cloudflare-starter-1"
    );
  });

  it("keeps runner names within GitHub's 64 characters", () => {
    const name = runnerName("h".repeat(80), "o/repo", 12);
    expect(name).toHaveLength(64);
    expect(name.endsWith("-repo-12")).toBe(true);
  });

  it("reads worker numbers only from this repository's names", () => {
    const prefix = "o-n-runner";
    expect(workerFromName(prefix, "o-n-runner-3")).toBe(3);
    expect(workerFromName(prefix, "o-n-runner-12-state")).toBe(12);
    expect(workerFromName(prefix, "o-n-runner-x")).toBeUndefined();
    expect(workerFromName(prefix, "o-n2-runner-1")).toBeUndefined();
    expect(workerFromName(prefix, "other-o-n-runner-1")).toBeUndefined();
  });
});

describe("composeEnv", () => {
  it("sets every variable the compose file requires", () => {
    expect(composeEnv("o/n", "host.local", 2, ["n", "fast"])).toEqual({
      RUNNER_IMAGE: "o-n-runner:local",
      RUNNER_PROJECT: "o-n-runner-2",
      RUNNER_NAME: "host-n-2",
      RUNNER_URL: "https://github.com/o/n",
      RUNNER_LABELS: "n,fast",
      RUNNER_REPO: "o/n",
      RUNNER_WORKER: "2",
    });
  });

  it("defaults the label to the repository name", () => {
    expect(defaultLabels("o/cloudflare-starter")).toEqual([
      "cloudflare-starter",
    ]);
    expect(runsOnValue(["cloudflare-starter"])).toBe(
      '["self-hosted","cloudflare-starter"]'
    );
  });
});

describe("planUp", () => {
  it("registers and starts every worker on a fresh machine", () => {
    expect(planUp(2, [])).toEqual({
      register: [1, 2],
      start: [1, 2],
      stop: [],
      idleRegistered: [],
    });
  });

  it("registers only workers whose volume has no registration", () => {
    const plan = planUp(3, [
      { worker: 1, registered: true, running: true },
      { worker: 2, registered: false, running: false },
    ]);
    expect(plan.register).toEqual([2, 3]);
    expect(plan.start).toEqual([1, 2, 3]);
  });

  it("stops running workers above the count and keeps them registered", () => {
    const plan = planUp(1, [
      { worker: 1, registered: true, running: true },
      { worker: 2, registered: true, running: true },
      { worker: 3, registered: true, running: false },
    ]);
    expect(plan).toEqual({
      register: [],
      start: [1],
      stop: [2],
      idleRegistered: [2, 3],
    });
  });
});

describe("removeTargets", () => {
  const existing = [
    { worker: 2, registered: true, running: false },
    { worker: 1, registered: true, running: true },
  ];

  it("--all takes every worker on this machine", () => {
    expect(removeTargets({ all: true, worker: [] }, existing)).toEqual([1, 2]);
  });

  it("--worker takes the listed ones", () => {
    expect(removeTargets({ all: false, worker: [2] }, existing)).toEqual([2]);
  });
});

describe("parseRegistration", () => {
  it("reads id and name from .runner, with or without a byte-order mark", () => {
    const runner = '{"agentId": 42, "agentName": "old-host-n-1", "poolId": 1}';
    expect(parseRegistration(runner)).toEqual({ id: 42, name: "old-host-n-1" });
    expect(parseRegistration(`﻿${runner}`)).toEqual({
      id: 42,
      name: "old-host-n-1",
    });
  });

  it("returns undefined for an empty or foreign file", () => {
    expect(parseRegistration("")).toBeUndefined();
    expect(parseRegistration('{"agentId": "x"}')).toBeUndefined();
  });
});

describe("versions", () => {
  it("reads Bun's version from packageManager", () => {
    expect(bunVersion("bun@1.3.14")).toBe("1.3.14");
    expect(bunVersion("npm@10.0.0")).toBeUndefined();
  });

  it("reads ARG defaults from a Dockerfile", () => {
    const args = dockerfileArgs(
      "FROM x\nARG A=1\nARG TARGETARCH\nARG B_SHA=ab\n"
    );
    expect([...args]).toEqual([
      ["A", "1"],
      ["B_SHA", "ab"],
    ]);
  });
});
