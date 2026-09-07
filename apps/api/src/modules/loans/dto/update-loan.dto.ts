import { IsDateString, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class UpdateLoanDto {
  @IsOptional()
  @IsString()
  @Matches(/^\+7\d{10}$/)
  borrowerPhone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  principalAmount?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  purpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
