import { Recipe } from '@/types/recipe';

export type RootStackParamList = {
  '(tabs)': undefined;
  'modal': undefined;
  'recipe-detail': { recipe: Recipe };
  'index': undefined;
  'two': undefined;
  'scale': undefined;
};
