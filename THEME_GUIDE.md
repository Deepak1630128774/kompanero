# 🎨 Kompanero Tracking Dashboard - Theme Guide

## Color Palette

### Primary Colors
```css
--primary-brown: #8B6F47   /* Main brand color - leather brown */
--dark-brown: #5D4E37      /* Headers, dark accents */
--light-brown: #C19A6B     /* Highlights, secondary buttons */
```

### Background Colors
```css
--beige: #F5E6D3           /* Soft background accent */
--off-white: #FAF7F2       /* Main background */
--leather-texture: #A0826D /* Texture accents */
```

### Shadow & Effects
```css
--shadow: rgba(0, 0, 0, 0.1)      /* Light shadow */
--shadow-dark: rgba(0, 0, 0, 0.2) /* Hover effects */
```

## Component Styling

### 1. Header
- **Background**: Gradient (dark-brown → primary-brown)
- **Text**: Off-white
- **Logo**: White background with rounded corners
- **Shadow**: 4px blur

### 2. Buttons

#### Primary Button
```css
Background: Gradient (primary-brown → dark-brown)
Color: White
Padding: 12px 30px
Border-radius: 8px
Hover: Lift effect (-2px translateY)
```

#### Secondary Button
```css
Background: Light-brown
Color: White
Padding: 10px 20px
Hover: Changes to primary-brown
```

### 3. Progress Bar
```css
Container:
  - Height: 40px
  - Background: White
  - Border-radius: 20px
  - Inset shadow

Bar:
  - Gradient: primary-brown → light-brown → primary-brown
  - Shimmer animation (2s infinite)
  - Smooth width transition (0.5s)
  - Glow shadow effect
```

### 4. Status Badges
```css
Delivered:  #D4EDDA background, #155724 text (green)
Transit:    #FFF3CD background, #856404 text (yellow)
Pending:    #F8D7DA background, #721C24 text (red)
Default:    #E2E3E5 background, #383D41 text (gray)
```

### 5. Input Fields
```css
Border: 2px solid light-brown
Background: Off-white
Border-radius: 8px
Focus: Primary-brown border with subtle glow
```

### 6. Cards/Sections
```css
Background: White
Border-radius: 12px
Shadow: 0 4px 12px rgba(0,0,0,0.1)
Padding: 30px
```

## Animations

### 1. Shimmer (Progress Bar)
```css
@keyframes shimmer {
  0%   { background-position: 200% 0 }
  100% { background-position: -200% 0 }
}
Duration: 2s infinite
```

### 2. Pulse (Loading Text)
```css
@keyframes pulse {
  0%, 100% { opacity: 0.6 }
  50%      { opacity: 1 }
}
Duration: 2s ease-in-out infinite
```

### 3. Bag Animation (Satchel)
```css
5 different bags fade in sequentially
Each animation: 4500ms infinite
Delays: 0ms, 450ms, 900ms, 1350ms, 1800ms
```

### 4. Hover Effects
```css
Buttons: translateY(-2px) + enhanced shadow
Table rows: Background color change
Links: Color change to primary-brown
```

## Typography

### Font Family
```css
font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
```

### Font Sizes
```css
Title (h1):           2rem (32px)
Section Headers (h2): 1.5rem (24px)
Progress Title (h3):  1.5rem (24px)
Body Text:            1rem (16px)
Small Text:           0.9rem (14.4px)
Table Text:           0.9rem (14.4px)
```

### Font Weights
```css
Normal:  400
Medium:  500
Semibold: 600
Bold:    700
```

## Spacing

### Padding
```css
Large sections:  60px 30px
Medium sections: 30px
Small elements:  12px
Buttons:         12px 30px
```

### Margins
```css
Between sections: 30px
Between elements: 20px
Small gaps:       8px
```

### Border Radius
```css
Cards/Sections:  12px
Buttons:         8px
Progress Bar:    20px (pill shape)
Status Badges:   12px
```

## Responsive Breakpoints

### Mobile (max-width: 768px)
- Single column layout
- Smaller font sizes
- Reduced padding
- Stacked buttons
- Smaller satchel animation

## Design Principles

1. **Consistency**: All browns follow leather bag theme
2. **Hierarchy**: Clear visual hierarchy with size and color
3. **Feedback**: Hover states and animations for all interactions
4. **Accessibility**: Good contrast ratios for readability
5. **Smoothness**: All transitions are 0.3s ease
6. **Professional**: Clean, modern, business-appropriate design

## Brand Identity

The design reflects Kompanero's leather goods brand:
- **Warm browns** evoke quality leather
- **Smooth animations** suggest craftsmanship
- **Clean layout** represents attention to detail
- **Satchel animation** directly ties to product line
