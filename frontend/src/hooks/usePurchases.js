/**
 * Google Play satın alma hook'u — RevenueCat Capacitor SDK.
 * Web'de null döner, sadece Android'de çalışır.
 */
import { useState, useEffect } from 'react'

const RC_API_KEY = import.meta.env.VITE_REVENUECAT_API_KEY || ''
const ENTITLEMENT_ID = 'premium'

// RevenueCat SDK yalnızca native ortamda mevcuttur
function isNative() {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()
}

export function usePurchases(userId) {
  const [offering, setOffering] = useState(null)
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!isNative() || !RC_API_KEY || !userId) return
    let cancelled = false

    async function init() {
      try {
        const { Purchases } = await import('@revenuecat/purchases-capacitor')
        await Purchases.configure({ apiKey: RC_API_KEY, appUserID: userId })
        const { current } = await Purchases.getOfferings()
        if (!cancelled && current) setOffering(current)
        setInitialized(true)
      } catch (e) {
        console.error('[RC] init error:', e)
      }
    }
    init()
    return () => { cancelled = true }
  }, [userId])

  async function purchasePremium() {
    if (!isNative() || !initialized) return null
    setLoading(true)
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor')
      const pkg = offering?.availablePackages?.[0]
      if (!pkg) throw new Error('Paket bulunamadı')
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg })
      const active = customerInfo.entitlements.active[ENTITLEMENT_ID]
      return active ? customerInfo : null
    } catch (e) {
      if (e.code !== 'PURCHASE_CANCELLED') throw e
      return null
    } finally {
      setLoading(false)
    }
  }

  async function restorePurchases() {
    if (!isNative()) return null
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor')
      const { customerInfo } = await Purchases.restorePurchases()
      return customerInfo.entitlements.active[ENTITLEMENT_ID] ? customerInfo : null
    } catch (e) {
      console.error('[RC] restore error:', e)
      return null
    }
  }

  return {
    isNative: isNative(),
    offering,
    initialized,
    loading,
    purchasePremium,
    restorePurchases,
  }
}
