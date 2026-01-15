import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';

// RevenueCat API Keys
// Get these from: https://app.revenuecat.com/apps
// 1. Create new app for iOS
// 2. Go to API Keys section
// 3. Copy the public SDK key
const REVENUECAT_IOS_KEY = 'appl_XXXXXXXXXXXXXXXXXXXXXXXX'; // Replace with your key
const REVENUECAT_ANDROID_KEY = 'goog_XXXXXXXXXXXXXXXXXXXXXXXX'; // Replace with your key

// Entitlement ID - must match what you set in RevenueCat dashboard
const PRO_ENTITLEMENT = 'pro';

class SubscriptionService {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

    // Skip if using placeholder keys
    if (apiKey.includes('XXXX')) {
      console.log('RevenueCat: Using placeholder keys, subscription disabled');
      return;
    }

    try {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      await Purchases.configure({ apiKey });
      this.initialized = true;
      console.log('RevenueCat initialized successfully');
    } catch (e) {
      console.error('Failed to initialize RevenueCat:', e);
    }
  }

  async getOfferings(): Promise<PurchasesPackage[]> {
    if (!this.initialized) return [];

    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        return offerings.current.availablePackages;
      }
    } catch (e) {
      console.error('Failed to get offerings:', e);
    }
    return [];
  }

  async purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
    if (!this.initialized) return false;

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return this.checkSubscriptionStatus(customerInfo);
    } catch (e: any) {
      if (!e.userCancelled) {
        console.error('Purchase failed:', e);
      }
      return false;
    }
  }

  async purchaseMonthly(): Promise<boolean> {
    const packages = await this.getOfferings();
    const monthly = packages.find(p => p.packageType === 'MONTHLY');
    if (monthly) {
      return this.purchasePackage(monthly);
    }
    return false;
  }

  async purchaseYearly(): Promise<boolean> {
    const packages = await this.getOfferings();
    const yearly = packages.find(p => p.packageType === 'ANNUAL');
    if (yearly) {
      return this.purchasePackage(yearly);
    }
    return false;
  }

  async restorePurchases(): Promise<boolean> {
    if (!this.initialized) return false;

    try {
      const customerInfo = await Purchases.restorePurchases();
      return this.checkSubscriptionStatus(customerInfo);
    } catch (e) {
      console.error('Restore failed:', e);
      return false;
    }
  }

  async isSubscribed(): Promise<boolean> {
    if (!this.initialized) return false;

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return this.checkSubscriptionStatus(customerInfo);
    } catch (e) {
      console.error('Failed to check subscription:', e);
      return false;
    }
  }

  private checkSubscriptionStatus(customerInfo: CustomerInfo): boolean {
    return customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
  }

  async setUserId(userId: string): Promise<void> {
    if (!this.initialized) return;

    try {
      await Purchases.logIn(userId);
    } catch (e) {
      console.error('Failed to set user ID:', e);
    }
  }

  async setUserEmail(email: string): Promise<void> {
    if (!this.initialized) return;

    try {
      await Purchases.setEmail(email);
    } catch (e) {
      console.error('Failed to set email:', e);
    }
  }
}

export const subscriptionService = new SubscriptionService();

/*
REVENUECAT SETUP INSTRUCTIONS:

1. Create RevenueCat Account
   - Go to https://www.revenuecat.com
   - Sign up for free account

2. Create iOS App
   - Click "Add New App"
   - Select "Apple App Store"
   - Enter your bundle ID: com.swipestreet.app

3. Connect to App Store Connect
   - In RevenueCat, go to your app settings
   - Add App Store Connect API key (requires Apple Developer account)
   - Or use Shared Secret from App Store Connect

4. Create Products in App Store Connect
   - Go to App Store Connect > Your App > Subscriptions
   - Create Subscription Group: "SwipeStreet Pro"
   - Add products:
     - swipestreet.pro.monthly ($9.99/month)
     - swipestreet.pro.yearly ($79.99/year)

5. Create Entitlement in RevenueCat
   - Go to your app > Entitlements
   - Create entitlement called "pro"
   - Attach your subscription products

6. Create Offering in RevenueCat
   - Go to Offerings
   - Create "default" offering
   - Add Monthly and Annual packages

7. Copy API Key
   - Go to your app > API Keys
   - Copy the "Public SDK Key"
   - Replace REVENUECAT_IOS_KEY above

8. Test with Sandbox
   - Create sandbox tester in App Store Connect
   - Test purchases on real device
*/
