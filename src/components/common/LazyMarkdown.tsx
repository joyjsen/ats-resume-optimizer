import React, { Suspense, lazy } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

const Markdown = lazy(() => import('react-native-markdown-display'));

interface LazyMarkdownProps {
    children: string;
    style?: any;
    [key: string]: any;
}

const LazyMarkdown: React.FC<LazyMarkdownProps> = (props) => {
    return (
        <Suspense fallback={
            <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" />
            </View>
        }>
            <Markdown {...props} />
        </Suspense>
    );
};

export default LazyMarkdown;
