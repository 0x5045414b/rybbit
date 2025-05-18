"use client";

import { FreeTrialBanner } from "../../../../components/FreeTrialBanner";
import { userStore } from "../../../../lib/userStore";
import { NoData } from "./NoData";
import { UsageBanners } from "./UsageBanners";

export function Header() {
  const { user } = userStore();

  return (
    <div className="flex flex-col">
      {user && (
        <div className="flex flex-col gap-4 m-4 mb-0">
          <FreeTrialBanner />
          <UsageBanners />
          <NoData />
        </div>
      )}
    </div>
  );
}
