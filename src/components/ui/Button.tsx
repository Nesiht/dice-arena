import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

type ButtonVariant = 'primary' | 'secondary';

type ButtonProps = PressableProps & {
  label: string;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function Button({ label, variant = 'primary', style, labelStyle, ...props }: ButtonProps) {
  const resolvedLabelStyle = [
    variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel,
    labelStyle,
  ];

  return (
    <Pressable
      style={({ pressed }) => [
        variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
        style,
        pressed && styles.buttonPressed,
      ]}
      {...props}
    >
      <Text style={resolvedLabelStyle}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 16,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: '#94a3b8',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  primaryLabel: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryLabel: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
