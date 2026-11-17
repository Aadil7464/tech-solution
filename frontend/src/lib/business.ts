export const business = {
  name: "Tech Solutions",
  email: "techsolutions286@gmail.com",
  team: [
    { name: "Mohammad Aadil", phone: "7464891312", location: "Bahlolpur, Noida, Uttar Pradesh" },
    { name: "Shadab Sheikh", phone: "8941024813", location: "Burari, Delhi" },
    { name: "Mohd. Suleman", phone: "6397554750", location: "Bengaluru, Karnataka" },
  ],
} as const;

export const telephone = (phone: string) => `tel:+91${phone}`;
