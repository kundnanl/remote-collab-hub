"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/app/onboarding/_actions";

export default function OnboardingComponent() {
  const [error, setError] = useState("");
  const { user } = useUser();
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const res = await completeOnboarding(formData);
    if (res?.message) {
      await user?.reload();
      router.push("/");
    } else {
      setError(res?.error || "Something went wrong.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-xl font-bold">Complete Your Onboarding</h1>
      <form onSubmit={handleSubmit} className="w-1/2 p-4 border rounded">
        <div>
          <label>Organization Name</label>
          <input type="text" name="organizationName" required className="border p-2 w-full" />
        </div>

        <div>
          <label>Role</label>
          <select name="role" required className="border p-2 w-full">
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
          </select>
        </div>

        {error && <p className="text-red-600">Error: {error}</p>}
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 mt-4">
          Submit
        </button>
      </form>
    </div>
  );
}
