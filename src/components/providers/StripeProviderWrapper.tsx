import React, { ReactElement } from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import { ENV } from '../../config/env';

interface Props {
    children: ReactElement | ReactElement[];
}

export const StripeProviderWrapper: React.FC<Props> = ({ children }) => {
    const publishableKey = (ENV.STRIPE_PUBLISHABLE_KEY || 'pk_test_sample').trim();

    // Diagnostic log (safe)
    console.log(`[Stripe] Initializing with key: ${publishableKey.substring(0, 12)}...${publishableKey.slice(-4)} (Length: ${publishableKey.length})`);

    return (
        <StripeProvider
            publishableKey={publishableKey}
            merchantIdentifier="merchant.com.jsn22.atsresumeoptimizer"
        >
            {children}
        </StripeProvider>
    );
};
