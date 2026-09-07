import { IsDateString, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateLoanDto {
  @IsString()
  @Matches(/^\+7\d{10}$/, { message: 'Телефон заёмщика должен быть в формате +7XXXXXXXXXX' })
  borrowerPhone!: string;

  @IsInt()
  @Min(1)
  principalAmount!: number;

  @IsDateString()
  dueDate!: string;

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
