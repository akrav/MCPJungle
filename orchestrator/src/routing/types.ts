export type RouteMode = 'shared' | 'per_user';

export type RouteDecision = {
  baseUrl: string;
  mode: RouteMode;
};


