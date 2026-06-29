import React, { useRef, useEffect, useState } from 'react';
import { View, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { ThemedText } from './themed-text';
import { Fonts } from '@/constants/theme';

interface ScrollPickerProps {
  items: number[];
  selectedValue: number;
  onValueChange: (val: number) => void;
  itemWidth?: number;
  visibleItems?: number;
  textColor?: string;
}

export function ScrollPicker({
  items,
  selectedValue,
  onValueChange,
  itemWidth = 60,
  visibleItems = 3,
  textColor = '#000'
}: ScrollPickerProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const isScrolling = useRef(false);
  
  // Find the exact index, defaulting to 0 if not found
  const exactIndex = Math.max(0, items.indexOf(selectedValue));
  const [currentIndex, setCurrentIndex] = useState(exactIndex);
  const paddingItemsCount = Math.floor(visibleItems / 2);

  // Add dummy items for padding so the first and last item can be centered
  const paddedItems = [
    ...Array(paddingItemsCount).fill(-1),
    ...items,
    ...Array(paddingItemsCount).fill(-1),
  ];

  // If external value changes (like resetting the timer), scroll to it
  useEffect(() => {
    // DO NOT snap if the user is actively scrolling!
    if (isScrolling.current) return;

    const idx = items.indexOf(selectedValue);
    if (idx !== -1 && idx !== currentIndex) {
      setCurrentIndex(idx);
      scrollViewRef.current?.scrollTo({ x: idx * itemWidth, animated: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedValue, itemWidth]); // Omit items to prevent re-render loops from inline arrays

  // Initial scroll on mount
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ x: exactIndex * itemWidth, animated: false });
    }, 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    let index = Math.round(offsetX / itemWidth);
    if (index < 0) index = 0;
    if (index >= items.length) index = items.length - 1;
    
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    isScrolling.current = false;
    const offsetX = event.nativeEvent.contentOffset.x;
    let index = Math.round(offsetX / itemWidth);
    if (index < 0) index = 0;
    if (index >= items.length) index = items.length - 1;
    
    onValueChange(items[index]);
  };

  return (
    <View style={{ width: itemWidth * visibleItems, height: 60, overflow: 'hidden' }}>
      <ScrollView
        ref={scrollViewRef}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth}
        decelerationRate="fast"
        scrollEventThrottle={16} // Fire smoothly at 60fps
        onScrollBeginDrag={() => { isScrolling.current = true; }}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={(e) => {
          // Only trigger if there's no momentum, otherwise let momentum handle it
          if (e.nativeEvent.velocity && Math.abs(e.nativeEvent.velocity.x) < 0.1) {
            handleScrollEnd(e);
          }
        }}
        nestedScrollEnabled={true}
        contentContainerStyle={{ alignItems: 'center' }}
      >
        {paddedItems.map((item, index) => {
          const isSelected = index === currentIndex + paddingItemsCount;
          return (
            <View key={index} style={{ width: itemWidth, height: 60, justifyContent: 'center', alignItems: 'center' }}>
              {item !== -1 && (
                <ThemedText style={{
                  color: textColor,
                  fontSize: isSelected ? 28 : 20,
                  fontFamily: isSelected ? Fonts.sansBold : Fonts.sansMedium,
                  opacity: isSelected ? 1 : 0.3,
                  transform: [{ scale: isSelected ? 1.1 : 1 }]
                }}>
                  {item}
                </ThemedText>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
