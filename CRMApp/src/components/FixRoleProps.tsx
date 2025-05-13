/**
 * This utility function helps replace deprecated accessibilityRole with role
 * for components that have not been updated yet
 */
export function fixRoleProps(props: any): any {
  if (props && props.accessibilityRole && !props.role) {
    // Create a new props object
    const updatedProps = { ...props };
    // Add the role property with the same value as accessibilityRole
    updatedProps.role = props.accessibilityRole;
    // Delete the deprecated accessibilityRole
    delete updatedProps.accessibilityRole;
    return updatedProps;
  }
  return props;
}
