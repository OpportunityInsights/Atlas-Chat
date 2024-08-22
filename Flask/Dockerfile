FROM python:3.8-alpine

# Install necessary build dependencies and libraries
RUN apk add --no-cache \
    gcc \
    musl-dev \
    gfortran \
    g++ \
    libatomic \
    libffi-dev \
    openssl-dev \
    python3-dev \
    geos \
    geos-dev

# Set environment variables
ENV GDAL_VERSION=3.4.1

# Set the working directory
WORKDIR /Flask

# Copy requirements file
COPY ./requirements.txt ./requirements.txt

# Install Python dependencies
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy the rest of your application code (assuming you have other files)
COPY . /Flask

# Set entrypoint
ENTRYPOINT ["python"]

# Default command
CMD ["main.py"]