"use client";

import Link from "next/link";
import { useActionState } from "react";
import { OrganizationSelect } from "@/components/affiliations/organization-select";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { updateAffiliationAction } from "@/modules/affiliations/actions";
import type { OrganizationOption } from "@/modules/affiliations/organizations";

export function AffiliationForm({
  school,
  company,
  showAffiliation,
}: {
  school: OrganizationOption | null;
  company: OrganizationOption | null;
  showAffiliation: boolean;
}) {
  const [state, action] = useActionState(updateAffiliationAction, initialFormState);
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <FormField
        name="schoolId"
        label="School"
        description="Search by name, abbreviation, or web address."
        error={state.fieldErrors?.schoolId}
      >
        {(props) => (
          <OrganizationSelect {...props} kind="SCHOOL" noun="school" defaultValue={school} />
        )}
      </FormField>
      <FormField
        name="companyId"
        label="Company"
        description="Larger companies only, for now."
        error={state.fieldErrors?.companyId}
      >
        {(props) => (
          <OrganizationSelect {...props} kind="COMPANY" noun="company" defaultValue={company} />
        )}
      </FormField>
      <CheckboxField
        id="field-showAffiliation"
        name="showAffiliation"
        label="Show my school and company to my groups"
        description="People in your groups see them beside your name in the member list. Nobody else does."
        defaultChecked={state.values ? state.values.showAffiliation === "on" : showAffiliation}
      />
      <p className="text-ink-muted">
        Your solves count toward your school&apos;s and company&apos;s totals on{" "}
        <Link href="/rankings" className="text-ink underline underline-offset-4">
          Rankings
        </Link>
        , never with your name. A school or company is listed once 5 people have chosen it.
      </p>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FormAlert state={state} className="mr-auto" />
        <SubmitButton variant="outline" pendingLabel="Saving…">
          Save school and company
        </SubmitButton>
      </div>
    </form>
  );
}
