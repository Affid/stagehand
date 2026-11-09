// What went wrong, read out as it appears.
export function ErrorLine(props: { readonly error: string }) {
  return props.error ? (
    <p class="mlh-err" role="alert">
      {props.error}
    </p>
  ) : null;
}
