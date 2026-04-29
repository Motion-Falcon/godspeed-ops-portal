import { z } from "zod";

// Define form schema function to support translations
export const createPositionFormSchema = (t: (key: string) => string) => {
  const detailRowSchema = z.object({
    subcategoryPosition: z.string(),
    payrateType: z
      .string()
      .min(1, { message: t("positionCreate.errors.payrateTypeRequired") }),
    numberOfPositions: z.coerce.number().min(1, {
      message: t("positionCreate.errors.numberOfPositionsRequired"),
    }),
    regularPayRate: z
      .string()
      .min(1, { message: t("positionCreate.errors.regularPayRateRequired") }),
    premiumPayRate: z.string().optional(),
    markup: z.string().optional(),
    billRate: z
      .string()
      .min(1, { message: t("positionCreate.errors.billRateRequired") }),
  });

  return z
    .object({
      client: z
        .string()
        .min(1, { message: t("positionCreate.errors.clientRequired") }),
      title: z
        .string()
        .min(1, { message: t("positionCreate.errors.titleRequired") }),
      positionCode: z.string().optional(),
      startDate: z
        .string()
        .min(1, { message: t("positionCreate.errors.startDateRequired") }),
      endDate: z
        .string()
        .min(1, { message: t("positionCreate.errors.endDateRequired") }),
      showOnJobPortal: z.boolean().default(false),
      stat: z.boolean().default(false),
      isSubcategoryForm: z.boolean().default(false),
      subcategoryPosition: z.array(z.string()).default([]),
      subcategoryPositionDetails: z.array(detailRowSchema).default([]),
      clientManager: z.string().optional(),
      salesManager: z.string().optional(),
      positionNumber: z.string().optional(),
      description: z
        .string()
        .min(1, { message: t("positionCreate.errors.descriptionRequired") }),

      streetAddress: z
        .string()
        .min(1, { message: t("positionCreate.errors.streetAddressRequired") }),
      city: z
        .string()
        .min(1, { message: t("positionCreate.errors.cityRequired") }),
      province: z
        .string()
        .min(1, { message: t("positionCreate.errors.provinceRequired") }),
      postalCode: z
        .string()
        .min(1, { message: t("positionCreate.errors.postalCodeRequired") }),

      employmentTerm: z
        .string()
        .min(1, { message: t("positionCreate.errors.employmentTermRequired") }),
      employmentType: z
        .string()
        .min(1, { message: t("positionCreate.errors.employmentTypeRequired") }),
      positionCategory: z
        .string()
        .min(1, {
          message: t("positionCreate.errors.positionCategoryRequired"),
        }),
      experience: z
        .string()
        .min(1, { message: t("positionCreate.errors.experienceRequired") }),

      documentsRequired: z.object({
        license: z.boolean().default(false),
        driverAbstract: z.boolean().default(false),
        tdgCertificate: z.boolean().default(false),
        sin: z.boolean().default(false),
        immigrationStatus: z.boolean().default(false),
        passport: z.boolean().default(false),
        cvor: z.boolean().default(false),
        resume: z.boolean().default(false),
        articlesOfIncorporation: z.boolean().default(false),
        directDeposit: z.boolean().default(false),
      }),

      // Optional at schema level; enforced in superRefine for non-subcategory.
      payrateType: z.string().optional(),
      numberOfPositions: z.coerce.number().optional(),
      regularPayRate: z.string().optional(),
      premiumPayRate: z.string().optional(),
      markup: z.string().optional(),
      billRate: z.string().optional(),

      overtimeEnabled: z.boolean().default(false),
      overtimeHours: z.string().optional(),
      overtimeBillRate: z.string().optional(),
      overtimePayRate: z.string().optional(),

      preferredPaymentMethod: z.string().default("N/A"),
      terms: z.string().default("N/A"),

      notes: z
        .string()
        .min(1, { message: t("positionCreate.errors.notesRequired") }),
      assignedTo: z.string().optional(),
      projCompDate: z.string().optional(),
      taskTime: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.isSubcategoryForm) {
        const labels = data.subcategoryPosition
          .map((x) => String(x).trim())
          .filter(Boolean);
        if (labels.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("positionCreate.errors.subcategoryPositionRequired"),
            path: ["subcategoryPosition"],
          });
          return;
        }

        const details = data.subcategoryPositionDetails ?? [];
        if (details.length !== labels.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("positionCreate.errors.subcategoryPositionDetailsMismatch"),
            path: ["subcategoryPositionDetails"],
          });
          return;
        }

        for (let i = 0; i < labels.length; i++) {
          const lab = labels[i];
          const row = details[i];
          if (!row || String(row.subcategoryPosition).trim() !== lab) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t(
                "positionCreate.errors.subcategoryPositionDetailsMismatch"
              ),
              path: ["subcategoryPositionDetails", i],
            });
          }
        }
        return;
      }

      if (!Object.values(data.documentsRequired).some((value) => value === true)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("positionCreate.errors.documentsRequired"),
          path: ["documentsRequired", "root"],
        });
      }
      if (!data.payrateType?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("positionCreate.errors.payrateTypeRequired"),
          path: ["payrateType"],
        });
      }
      if (
        data.numberOfPositions === undefined ||
        data.numberOfPositions === null ||
        Number(data.numberOfPositions) < 1 ||
        Number.isNaN(Number(data.numberOfPositions))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("positionCreate.errors.numberOfPositionsRequired"),
          path: ["numberOfPositions"],
        });
      }
      if (!data.regularPayRate?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("positionCreate.errors.regularPayRateRequired"),
          path: ["regularPayRate"],
        });
      }
      if (!data.billRate?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("positionCreate.errors.billRateRequired"),
          path: ["billRate"],
        });
      }
    })
    .refine(
      (data) => {
        if (data.overtimeEnabled) {
          return (
            !!data.overtimeHours &&
            data.overtimeHours.trim() !== "" &&
            !!data.overtimeBillRate &&
            data.overtimeBillRate.trim() !== "" &&
            !!data.overtimePayRate &&
            data.overtimePayRate.trim() !== ""
          );
        }
        return true;
      },
      {
        message: t("positionCreate.errors.overtimeFieldsRequired"),
        path: ["overtimeEnabled"],
      }
    )
    .transform((data) => {
      if (!data.overtimeEnabled) {
        return {
          ...data,
          overtimeHours: "",
          overtimeBillRate: "",
          overtimePayRate: "",
        };
      }
      return data;
    });
};

export type PositionFormData = z.infer<
  ReturnType<typeof createPositionFormSchema>
>;
