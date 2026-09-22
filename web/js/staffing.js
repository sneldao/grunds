export const canChooseStaffing = (day, condition) => day >= 2 && condition < .55;
export const canHaveStaffCrisis = ({ day, staffing, condition, crisis, dayMin }) => day >= 2 && staffing === 'work' && !crisis && condition < .2 && dayMin >= 900 && dayMin < 1030;
