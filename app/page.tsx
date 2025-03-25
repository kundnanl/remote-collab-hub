'use client'

import { FeatureGrid } from '@/components/FeatureSection';
import { Footer } from '@/components/Footer';
import HeroSection from "@/components/HeroSection"
import { HowItWorks } from '@/components/HowItWorks';

export default function LandingPage() {

  return (
    <>
    <HeroSection />
    <FeatureGrid />
    <HowItWorks />
    <Footer />
    </>
  )
}
