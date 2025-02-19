class BaseEvents:

    def register(*args, **kargs) -> None:
        raise NotImplementedError("Subclasses must implement this method")
