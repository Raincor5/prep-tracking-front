// utils/colorUtils.ts

export const getColorForDish = (label: string): string => {
    const colors = [
      "#f94144",
      "#f3722c",
      "#f9c74f",
      "#90be6d",
      "#43aa8b",
      "#577590",
    ];
    const match = label.match(/Dish-(\d+)/);
    const index = match ? parseInt(match[1], 10) : 0;
    return colors[index % colors.length];
  };
  