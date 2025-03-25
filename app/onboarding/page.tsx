"use client";

import { useUser } from "@clerk/nextjs";
import { useState } from "react";
import { trpc } from "@/server/client";
import FullPageLoader from "@/components/FullPageLoader";

export default function OnboardingPage() {
  const { user } = useUser();
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [showLoader, setShowLoader] = useState(false);

  const mutation = trpc.user.completeOnboarding.useMutation({
    onSuccess: () => {
      setShowLoader(true);

      user?.reload().then(() => (window.location.href = "/dashboard"));
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  return (
    <div className="p-6 max-w-lg mx-auto">
    {showLoader && <FullPageLoader />}
      <h1 className="text-2xl font-semibold mb-4">Start Your Onboarding</h1>
      <input
        type="text"
        placeholder="Organization name"
        className="w-full border rounded px-3 py-2 mb-4"
        value={orgName}
        onChange={(e) => setOrgName(e.target.value)}
      />
      <button
        onClick={() => mutation.mutate({ orgName })}
        className="bg-black text-white px-4 py-2 rounded"
      >
        Complete Onboarding
      </button>
      {error && <p className="text-red-600 mt-2">{error}</p>}
    </div>
  );
}
