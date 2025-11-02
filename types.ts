
export interface UserCharacter {
  id: string;
  userId: string;
  characterName: string;
  description: string;
  keywords: string[];
  imageUrl: string;
  createdAt: {
    _seconds: number;
    _nanoseconds: number;
  } | Date;
}
